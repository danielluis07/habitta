declare module "gltf-validator" {
  export type ValidationReport = {
    issues: {
      numErrors: number;
      numWarnings: number;
      messages: { code: string; message: string; severity: number; pointer?: string }[];
    };
  };

  export function validateBytes(
    data: Uint8Array,
    options?: { uri?: string; format?: "glb"; maxIssues?: number; writeTimestamp?: boolean },
  ): Promise<ValidationReport>;
}
