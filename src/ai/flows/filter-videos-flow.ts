'use server';
/**
 * @fileOverview An AI-powered video filtering agent.
 *
 * - filterVideos - A function that filters videos based on a query.
 * - FilterVideosInput - The input type for the filterVideos function.
 * - FilterVideosOutput - The return type for the filterVideos function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const FilterVideosInputSchema = z.object({
  query: z.string().describe("The user's search query for movies."),
  videos: z.array(z.string()).describe('The list of all available video titles.'),
});
export type FilterVideosInput = z.infer<typeof FilterVideosInputSchema>;

const FilterVideosOutputSchema = z.object({
    filteredVideos: z.array(z.string()).describe('A list of video titles from the input that match the search query.'),
});
export type FilterVideosOutput = z.infer<typeof FilterVideosOutputSchema>;

export async function filterVideos(input: FilterVideosInput): Promise<FilterVideosOutput> {
  return filterVideosFlow(input);
}

const prompt = ai.definePrompt({
  name: 'filterVideosPrompt',
  input: {schema: FilterVideosInputSchema},
  output: {schema: FilterVideosOutputSchema},
  prompt: `You are an expert movie recommender. Your task is to filter a list of video titles based on a user's search query.

The user is looking for: {{{query}}}

Here is the list of available video titles:
{{#each videos}}
- {{{this}}}
{{/each}}

Return a JSON object containing a list of video titles from the provided list that are good matches for the user's query. The key for the list should be "filteredVideos". If no videos match, return an empty list. Only return titles that exist in the provided list. Do not make up new titles.`,
});

const filterVideosFlow = ai.defineFlow(
  {
    name: 'filterVideosFlow',
    inputSchema: FilterVideosInputSchema,
    outputSchema: FilterVideosOutputSchema,
  },
  async (input) => {
    // If the query is empty, there's no need to call the AI.
    if (input.query.trim() === '') {
        return { filteredVideos: input.videos };
    }
    const {output} = await prompt(input);
    return output || { filteredVideos: [] };
  }
);
