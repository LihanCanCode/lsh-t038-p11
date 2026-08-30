export type TravelMatrix = Record<string, Record<string, number>>;

export function getTravel(matrix: TravelMatrix, from: string, to: string): number {
  const row = matrix[from];
  if (!row || !(to in row)) {
    throw new Error(`Missing travel time from "${from}" to "${to}" in travel matrix.`);
  }
  return row[to];
}
