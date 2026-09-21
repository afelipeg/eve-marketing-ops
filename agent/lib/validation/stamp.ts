/** Runtime-owned audit metadata for a JEV decision. */
export async function validationTimestamp(): Promise<string> {
  "use step";
  return new Date().toISOString();
}
