declare module "qrcode-terminal" {
  export function generate(
    input: string,
    opts?: { small?: boolean },
    cb?: (qrcode: string) => void
  ): void;
  const qrcode: {
    generate: typeof generate;
  };
  export default qrcode;
}
