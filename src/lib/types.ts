export interface Video {
  id: string; // The blob name in Azure Storage
  title: string;
  thumbnail: string;
  source: 'azure';
}
