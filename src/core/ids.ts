let counter = 0;

export function uid(): string {
  counter = (counter + 1) % 0xfffff;
  return (
    Date.now().toString(36) +
    Math.random().toString(36).slice(2, 8) +
    counter.toString(36)
  );
}
