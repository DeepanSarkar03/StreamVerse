export interface Video {
  id: string; // composite id: `gdrive-${file.id}` or `onedrive-${file.id}`
  title: string;
  thumbnail: string;
  source: 'gdrive' | 'onedrive';
}
