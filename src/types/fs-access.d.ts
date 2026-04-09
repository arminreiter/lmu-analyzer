interface FileSystemDirectoryHandle {
  kind: 'directory';
  name: string;
  values(): AsyncIterableIterator<FileSystemFileHandle | FileSystemDirectoryHandle>;
}

interface FileSystemFileHandle {
  kind: 'file';
  name: string;
  getFile(): Promise<File>;
}

interface Window {
  showDirectoryPicker(options?: { id?: string; startIn?: string; mode?: string }): Promise<FileSystemDirectoryHandle>;
}
