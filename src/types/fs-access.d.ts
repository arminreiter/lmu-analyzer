interface FileSystemDirectoryHandle {
  kind: 'directory';
  name: string;
  values(): AsyncIterableIterator<FileSystemFileHandle | FileSystemDirectoryHandle>;
  queryPermission(descriptor?: { mode?: 'read' | 'readwrite' }): Promise<PermissionState>;
  requestPermission(descriptor?: { mode?: 'read' | 'readwrite' }): Promise<PermissionState>;
}

interface FileSystemFileHandle {
  kind: 'file';
  name: string;
  getFile(): Promise<File>;
}

interface Window {
  showDirectoryPicker(options?: { id?: string; startIn?: string; mode?: string }): Promise<FileSystemDirectoryHandle>;
}
