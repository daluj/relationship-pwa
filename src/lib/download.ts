/**
 * Saves a file locally: File System Access API where available, otherwise `<a download>`
 * (features §8.9). Nothing leaves the device.
 */
export async function saveFile(name: string, mime: string, content: BlobPart): Promise<boolean> {
  const blob = new Blob([content], { type: mime });
  const picker = (
    window as unknown as { showSaveFilePicker?: (o: unknown) => Promise<FileSystemFileHandle> }
  ).showSaveFilePicker;
  if (picker) {
    try {
      const ext = name.slice(name.lastIndexOf('.'));
      const handle = await picker({ suggestedName: name, types: [{ accept: { [mime]: [ext] } }] });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return true;
    } catch (e) {
      if ((e as DOMException).name === 'AbortError') return false; // user cancelled
      // Fall through to the download link (e.g. picker blocked in an iframe).
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
}
