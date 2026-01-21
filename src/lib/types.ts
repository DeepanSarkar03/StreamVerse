export interface Video {
  id: string; // The blob name in Azure Storage
  title: string;
  thumbnail: string;
  source: 'azure';
  streamUrl?: string; // Direct URL to stream from Azure
}
