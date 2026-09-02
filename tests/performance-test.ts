/**
 * 反向差异存储策略性能对比。
 *
 * 该脚本只输出比较数据，不设置固定的性能通过阈值；这样可以在不同机器
 * 上重复运行，并观察 optimized 与 baseline 的相对变化。
 */

import { TextVersion } from "../src/TextVersion";
import RLog from "rlog-js";

type Variant = "optimized" | "baseline";

interface BenchmarkResult {
  name: string;
  optimizedMs: number;
  baselineMs: number;
  optimizedStorageBefore: number;
  optimizedStorageAfter: number;
  baselineStorageBefore: number;
  baselineStorageAfter: number;
}

const rlog = new RLog();

const versionCount = 90;
const appendCount = 30;
const readIterations = 2000;
const showIterations = 500;
const warmupIterations = 5;

function createTextVersion(
  optimizeDiffStorage: boolean,
  initialStorage?: string,
): TextVersion {
  return new TextVersion(
    initialStorage,
    undefined,
    { optimizeDiffStorage },
  );
}

function contentFor(version: number): string {
  const body =
    version % 3 === 1
      ? "A".repeat(20) + "B".repeat(160)
      : version % 3 === 2
        ? "B".repeat(160)
        : "C".repeat(200);

  return ["performance benchmark document", `revision=${version}`, body].join(
    "\n",
  );
}

function storageLength(tv: TextVersion): number {
  return tv.export().length;
}

function assertContent(
  variant: Variant,
  operation: string,
  actual: string | null,
  expected: string,
): void {
  if (actual !== expected) {
    throw new Error(
      `${variant} ${operation} 返回内容不正确: 期望长度 ${expected.length}, 实际长度 ${actual?.length ?? "null"}`,
    );
  }
}

function warmupRead(
  tv: TextVersion,
  variant: Variant,
  expectedLatest: string,
  expectedMiddle: string,
  expectedFirst: string,
): void {
  for (let i = 0; i < warmupIterations; i++) {
    assertContent(variant, "warmup latest()", tv.latest(), expectedLatest);
    assertContent(
      variant,
      "warmup show(middle)",
      tv.show(`v${Math.floor(versionCount / 2)}`),
      expectedMiddle,
    );
    assertContent(variant, "warmup show(v1)", tv.show("v1"), expectedFirst);
  }
}

function measureRead(
  name: string,
  optimized: TextVersion,
  baseline: TextVersion,
  operation: string,
  expected: string,
  iterations: number,
  read: (tv: TextVersion) => string | null,
): BenchmarkResult {
  const optimizedStorageBefore = storageLength(optimized);
  const baselineStorageBefore = storageLength(baseline);

  const optimizedStart = performance.now();
  for (let i = 0; i < iterations; i++) {
    assertContent("optimized", operation, read(optimized), expected);
  }
  const optimizedMs = performance.now() - optimizedStart;

  const baselineStart = performance.now();
  for (let i = 0; i < iterations; i++) {
    assertContent("baseline", operation, read(baseline), expected);
  }
  const baselineMs = performance.now() - baselineStart;

  return {
    name,
    optimizedMs,
    baselineMs,
    optimizedStorageBefore,
    optimizedStorageAfter: storageLength(optimized),
    baselineStorageBefore,
    baselineStorageAfter: storageLength(baseline),
  };
}

function measureBatchCommit(): {
  optimized: TextVersion;
  baseline: TextVersion;
  result: BenchmarkResult;
} {
  const optimized = createTextVersion(true);
  const baseline = createTextVersion(false);

  const optimizedStart = performance.now();
  for (let i = 1; i <= versionCount; i++) {
    optimized.commit(contentFor(i), `v${i}`);
  }
  const optimizedMs = performance.now() - optimizedStart;

  const baselineStart = performance.now();
  for (let i = 1; i <= versionCount; i++) {
    baseline.commit(contentFor(i), `v${i}`);
  }
  const baselineMs = performance.now() - baselineStart;

  return {
    optimized,
    baseline,
    result: {
      name: `批量 commit (${versionCount} 个版本)`,
      optimizedMs,
      baselineMs,
      optimizedStorageBefore: 0,
      optimizedStorageAfter: storageLength(optimized),
      baselineStorageBefore: 0,
      baselineStorageAfter: storageLength(baseline),
    },
  };
}

function measureAppendCommit(
  optimizedSource: TextVersion,
  baselineSource: TextVersion,
): BenchmarkResult {
  // 从各自的导出数据重新导入，避免把批量 commit 期间的任意缓存状态
  // 当作追加提交的唯一输入。
  const optimized = createTextVersion(true, optimizedSource.export());
  const baseline = createTextVersion(false, baselineSource.export());
  const expectedLatest = contentFor(versionCount);
  const expectedMiddle = contentFor(Math.floor(versionCount / 2));
  const expectedFirst = contentFor(1);

  warmupRead(
    optimized,
    "optimized",
    expectedLatest,
    expectedMiddle,
    expectedFirst,
  );
  warmupRead(
    baseline,
    "baseline",
    expectedLatest,
    expectedMiddle,
    expectedFirst,
  );

  const optimizedStorageBefore = storageLength(optimized);
  const baselineStorageBefore = storageLength(baseline);

  const optimizedStart = performance.now();
  for (let i = versionCount + 1; i <= versionCount + appendCount; i++) {
    optimized.commit(contentFor(i), `v${i}`);
  }
  const optimizedMs = performance.now() - optimizedStart;

  const baselineStart = performance.now();
  for (let i = versionCount + 1; i <= versionCount + appendCount; i++) {
    baseline.commit(contentFor(i), `v${i}`);
  }
  const baselineMs = performance.now() - baselineStart;

  const finalExpected = contentFor(versionCount + appendCount);
  assertContent("optimized", "追加 commit 后 latest()", optimized.latest(), finalExpected);
  assertContent("baseline", "追加 commit 后 latest()", baseline.latest(), finalExpected);

  return {
    name: `追加 commit (${appendCount} 个版本)`,
    optimizedMs,
    baselineMs,
    optimizedStorageBefore,
    optimizedStorageAfter: storageLength(optimized),
    baselineStorageBefore,
    baselineStorageAfter: storageLength(baseline),
  };
}

function formatRatio(optimizedMs: number, baselineMs: number): string {
  return baselineMs === 0 ? "n/a" : `${(optimizedMs / baselineMs).toFixed(3)}x`;
}

function formatDelta(before: number, after: number): string {
  const delta = after - before;
  return `${before}->${after} (${delta >= 0 ? "+" : ""}${delta})`;
}

function formatStorageRatio(optimized: number, baseline: number): string {
  return baseline === 0 ? "n/a" : `${(optimized / baseline).toFixed(3)}x`;
}

function logResult(result: BenchmarkResult): void {
  rlog.log(
    `${result.name}: optimized=${result.optimizedMs.toFixed(2)}ms, ` +
      `baseline=${result.baselineMs.toFixed(2)}ms, ` +
      `optimized/baseline=${formatRatio(result.optimizedMs, result.baselineMs)}, ` +
      `storage optimized=${formatDelta(result.optimizedStorageBefore, result.optimizedStorageAfter)}, ` +
      `baseline=${formatDelta(result.baselineStorageBefore, result.baselineStorageAfter)}, ` +
      `final storage optimized/baseline=${formatStorageRatio(result.optimizedStorageAfter, result.baselineStorageAfter)}`,
  );
}

rlog.log("=== 反向差异存储性能对比测试 ===");
rlog.log(
  `准备 ${versionCount} 个批量版本、${appendCount} 个追加版本；读取操作先预热 ${warmupIterations} 次。`,
);

const results: BenchmarkResult[] = [];
const batch = measureBatchCommit();
results.push(batch.result);

const expectedLatest = contentFor(versionCount);
const expectedMiddle = contentFor(Math.floor(versionCount / 2));
const expectedFirst = contentFor(1);

// 两个实例执行完全相同的预热读取，避免只测到 optimized 的缓存状态。
warmupRead(
  batch.optimized,
  "optimized",
  expectedLatest,
  expectedMiddle,
  expectedFirst,
);
warmupRead(
  batch.baseline,
  "baseline",
  expectedLatest,
  expectedMiddle,
  expectedFirst,
);

results.push(
  measureRead(
    `latest() (${readIterations} 次)`,
    batch.optimized,
    batch.baseline,
    "latest()",
    expectedLatest,
    readIterations,
    (tv) => tv.latest(),
  ),
);
results.push(
  measureRead(
    `show 中间版本 (${showIterations} 次)`,
    batch.optimized,
    batch.baseline,
    "show(middle)",
    expectedMiddle,
    showIterations,
    (tv) => tv.show(`v${Math.floor(versionCount / 2)}`),
  ),
);
results.push(
  measureRead(
    `show 首版本 (${showIterations} 次)`,
    batch.optimized,
    batch.baseline,
    "show(v1)",
    expectedFirst,
    showIterations,
    (tv) => tv.show("v1"),
  ),
);

results.push(measureAppendCommit(batch.optimized, batch.baseline));

rlog.log("\n指标（耗时、optimized/baseline 比率、存储长度变化）:");
results.forEach(logResult);
rlog.log("=== 性能对比测试完成 ===");
