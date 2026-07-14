// Wire format for session-detail navigation: "fileName::sessionIndex::encodedDriverName"

export function buildSessionContext(fileName: string, sessionIndex: number, driverName: string): string {
  return `${fileName}::${sessionIndex}::${encodeURIComponent(driverName)}`;
}

export function parseSessionContext(context: string): { fileName: string; sessionIndex: number; driverName: string | null } {
  const [fileName, idxStr, ...driverParts] = context.split('::');
  return {
    fileName,
    sessionIndex: Number(idxStr),
    driverName: driverParts.length > 0 ? decodeURIComponent(driverParts.join('::')) : null,
  };
}
