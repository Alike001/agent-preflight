export interface SecretFinding {
  path: string;
  kind: string;
}

const ENV_REFERENCE = /^\$\{[A-Z][A-Z0-9_]*\}$/;
const SENSITIVE_KEY =
  /^(authorization|api[_-]?key|password|private[_-]?key|mnemonic|seed[_-]?phrase|wallet[_-]?secret|session[_-]?secret|cookie|auth[_-]?token)$/i;

const VALUE_PATTERNS: Array<{ kind: string; pattern: RegExp }> = [
  {
    kind: "authorization header",
    pattern: /\bBearer\s+[A-Za-z0-9._~+/=-]{12,}/i,
  },
  {
    kind: "private key block",
    pattern: /-----BEGIN (?:EC |RSA )?PRIVATE KEY-----/,
  },
  { kind: "private key", pattern: /\b0x[a-fA-F0-9]{64}\b/ },
  {
    kind: "JWT",
    pattern: /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/,
  },
  { kind: "provider API key", pattern: /\b(?:sk|rk|pk)_[A-Za-z0-9_-]{20,}\b/ },
  {
    kind: "environment secret",
    pattern:
      /\b[A-Z][A-Z0-9_]*(?:KEY|SECRET|TOKEN|PASSWORD)\s*=\s*[^\s$][^\s]*/,
  },
];

export function findSecrets(root: unknown): SecretFinding[] {
  const findings: SecretFinding[] = [];
  const stack: Array<{
    value: unknown;
    path: string;
    sensitiveContext: boolean;
  }> = [{ value: root, path: "$", sensitiveContext: false }];

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) break;

    if (typeof current.value === "string") {
      if (!ENV_REFERENCE.test(current.value)) {
        if (current.sensitiveContext && current.value.trim()) {
          findings.push({ path: current.path, kind: "credential field" });
        }
        for (const candidate of VALUE_PATTERNS) {
          if (candidate.pattern.test(current.value)) {
            findings.push({ path: current.path, kind: candidate.kind });
          }
        }
      }
      continue;
    }

    if (Array.isArray(current.value)) {
      current.value.forEach((value, index) => {
        stack.push({
          value,
          path: `${current.path}[${index}]`,
          sensitiveContext: current.sensitiveContext,
        });
      });
      continue;
    }

    if (isRecord(current.value)) {
      for (const [key, value] of Object.entries(current.value)) {
        const path = `${current.path}.${key}`;
        const inInputSchemaDefinition =
          current.path.includes(".inputSchema") && isRecord(value);
        stack.push({
          value,
          path,
          sensitiveContext:
            !inInputSchemaDefinition &&
            (current.sensitiveContext || SENSITIVE_KEY.test(key)),
        });
      }
    }
  }

  return uniqueFindings(findings);
}

export function redactDefensively<T>(root: T): T {
  return redactValue(root, false, "$") as T;
}

function redactValue(
  value: unknown,
  sensitiveContext: boolean,
  path: string,
): unknown {
  if (typeof value === "string") {
    if (sensitiveContext) return "[REDACTED]";
    let redacted = value;
    for (const candidate of VALUE_PATTERNS)
      redacted = redacted.replace(candidate.pattern, "[REDACTED]");
    return redactUrl(redacted);
  }
  if (Array.isArray(value)) {
    return value.map((entry, index) =>
      redactValue(entry, sensitiveContext, `${path}[${index}]`),
    );
  }
  if (!isRecord(value)) return value;

  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => {
      const entryPath = `${path}.${key}`;
      const schemaDefinition = path.includes(".inputSchema") && isRecord(entry);
      return [
        key,
        redactValue(
          entry,
          !schemaDefinition && (sensitiveContext || SENSITIVE_KEY.test(key)),
          entryPath,
        ),
      ];
    }),
  );
}

function redactUrl(value: string): string {
  if (!/^https?:\/\//i.test(value)) return value;
  try {
    const url = new URL(value);
    url.username = "";
    url.password = "";
    url.search = "";
    return url.toString();
  } catch {
    return value;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function uniqueFindings(findings: SecretFinding[]): SecretFinding[] {
  return [
    ...new Map(
      findings.map((finding) => [`${finding.path}:${finding.kind}`, finding]),
    ).values(),
  ];
}
