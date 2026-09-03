export function omitDocumentId<T extends { id: string }>(
  value: T,
): Omit<T, "id"> {
  const { id, ...document } = value;
  void id;
  return document;
}
