export interface Video {
  id: string; // composite id: `onedrive-${file.id}`
  title: string;
  thumbnail: string;
  source: 'onedrive';
}
