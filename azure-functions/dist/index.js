"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const functions_1 = require("@azure/functions");
const storage_blob_1 = require("@azure/storage-blob");
// In-memory job storage (use Redis/Table Storage for production)
const jobs = new Map();
// Start download endpoint - queues a download job
functions_1.app.http('startDownload', {
    methods: ['POST'],
    authLevel: 'anonymous',
    route: 'download/start',
    handler: async (request, context) => {
        try {
            const body = await request.json();
            const { url, fileName, secret } = body;
            // Validate secret
            const expectedSecret = process.env.DOWNLOAD_SECRET;
            if (!expectedSecret || secret !== expectedSecret) {
                return { status: 401, jsonBody: { error: 'Unauthorized' } };
            }
            if (!url || !fileName) {
                return { status: 400, jsonBody: { error: 'URL and fileName are required' } };
            }
            const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
            const containerName = process.env.AZURE_STORAGE_CONTAINER_NAME;
            if (!connectionString || !containerName) {
                return { status: 500, jsonBody: { error: 'Storage not configured' } };
            }
            // Generate job ID
            const jobId = `job_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
            // Initialize job
            const job = {
                id: jobId,
                status: 'pending',
                progress: 0,
                speed: 0,
                downloadedSize: 0,
                totalSize: 0,
                fileName,
            };
            jobs.set(jobId, job);
            // Start download in background (non-blocking)
            downloadFile(jobId, url, fileName, connectionString, containerName).catch(err => {
                const job = jobs.get(jobId);
                if (job) {
                    job.status = 'error';
                    job.error = err.message;
                }
            });
            return {
                status: 202,
                jsonBody: { jobId, status: 'pending', message: 'Download started' }
            };
        }
        catch (error) {
            return { status: 500, jsonBody: { error: error.message } };
        }
    }
});
// Check download status endpoint
functions_1.app.http('checkDownload', {
    methods: ['GET'],
    authLevel: 'anonymous',
    route: 'download/status/{jobId}',
    handler: async (request, context) => {
        const jobId = request.params.jobId;
        const secret = request.query.get('secret');
        // Validate secret
        const expectedSecret = process.env.DOWNLOAD_SECRET;
        if (!expectedSecret || secret !== expectedSecret) {
            return { status: 401, jsonBody: { error: 'Unauthorized' } };
        }
        if (!jobId) {
            return { status: 400, jsonBody: { error: 'Job ID required' } };
        }
        const job = jobs.get(jobId);
        if (!job) {
            return { status: 404, jsonBody: { error: 'Job not found' } };
        }
        return { status: 200, jsonBody: job };
    }
});
// The actual download function - runs at datacenter speed!
async function downloadFile(jobId, url, fileName, connectionString, containerName) {
    const job = jobs.get(jobId);
    job.status = 'downloading';
    try {
        // Fetch the file - THIS HAPPENS AT DATACENTER SPEED (10+ Gbps)
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': '*/*',
            },
            redirect: 'follow',
        });
        if (!response.ok) {
            throw new Error(`Failed to fetch: ${response.status} ${response.statusText}`);
        }
        const contentLength = response.headers.get('content-length');
        job.totalSize = contentLength ? parseInt(contentLength, 10) : 0;
        const contentType = response.headers.get('content-type') || 'video/mp4';
        // Setup Azure Blob client
        const blobServiceClient = storage_blob_1.BlobServiceClient.fromConnectionString(connectionString);
        const containerClient = blobServiceClient.getContainerClient(containerName);
        await containerClient.createIfNotExists();
        const blockBlobClient = containerClient.getBlockBlobClient(fileName);
        // Stream to Azure - INTERNAL AZURE NETWORK (10+ Gbps)
        const reader = response.body?.getReader();
        if (!reader) {
            throw new Error('No response body');
        }
        // Collect chunks and upload in blocks
        const chunks = [];
        let totalSize = 0;
        const startTime = Date.now();
        const BLOCK_SIZE = 32 * 1024 * 1024; // 32MB blocks for speed
        let currentBlockData = [];
        let currentBlockSize = 0;
        const blockIds = [];
        let blockIndex = 0;
        while (true) {
            const { done, value } = await reader.read();
            if (done) {
                // Upload final block if any
                if (currentBlockSize > 0) {
                    const blockId = btoa(String(blockIndex).padStart(6, '0'));
                    blockIds.push(blockId);
                    const blockData = concatUint8Arrays(currentBlockData);
                    await blockBlobClient.stageBlock(blockId, blockData, blockData.length);
                }
                break;
            }
            totalSize += value.length;
            job.downloadedSize = totalSize;
            currentBlockData.push(value);
            currentBlockSize += value.length;
            // Upload block when it reaches target size
            if (currentBlockSize >= BLOCK_SIZE) {
                const blockId = btoa(String(blockIndex).padStart(6, '0'));
                blockIds.push(blockId);
                const blockData = concatUint8Arrays(currentBlockData);
                await blockBlobClient.stageBlock(blockId, blockData, blockData.length);
                currentBlockData = [];
                currentBlockSize = 0;
                blockIndex++;
            }
            // Update progress
            const elapsed = (Date.now() - startTime) / 1000;
            job.speed = elapsed > 0 ? (totalSize / (1024 * 1024)) / elapsed : 0;
            if (job.totalSize > 0) {
                job.progress = Math.round((totalSize / job.totalSize) * 100);
            }
        }
        // Commit all blocks
        await blockBlobClient.commitBlockList(blockIds, {
            blobHTTPHeaders: {
                blobContentType: contentType.startsWith('video/') ? contentType : 'video/mp4'
            }
        });
        job.status = 'completed';
        job.progress = 100;
    }
    catch (error) {
        job.status = 'error';
        job.error = error.message;
        throw error;
    }
}
function concatUint8Arrays(arrays) {
    const totalLength = arrays.reduce((sum, arr) => sum + arr.length, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;
    for (const arr of arrays) {
        result.set(arr, offset);
        offset += arr.length;
    }
    return result;
}
