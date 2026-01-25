/**
 * 性能对比测试
 * 对比新旧策略在获取最新版本时的性能差异
 */

import { TextVersion } from "../src/TextVersion";
import RLog from "rlog-js";

const rlog = new RLog();

rlog.log("=== 性能对比测试 ===");

// 测试配置
const versionCount = 1000;
const contentBase = "This is test content version ";

console.time("总测试时间");
rlog.log(`准备进行包含 ${versionCount} 个版本的性能测试...`);

// 创建测试实例并添加大量版本

const tv = new TextVersion();

const generateStart = performance.now();
for (let i = 1; i <= versionCount; i++) {
  tv.commit(contentBase + i, `v${i}`);
  rlog.progress(i, versionCount);
}
rlog.log(`已创建 ${versionCount} 个版本`);
const generateEnd = performance.now();
const generateTime = generateEnd - generateStart;
rlog.log(`  - 执行 ${versionCount} 次 commit(): ${generateTime.toFixed(2)}ms`);
rlog.log(`  - 平均每次: ${(generateEnd / versionCount).toFixed(4)}ms`);

// 测试1: 获取最新版本的性能（新策略的优势）
rlog.log("测试 latest() 方法性能:");
const latestStart = performance.now();
for (let i = 0; i < 10000; i++) {
  const content = tv.latest();
  if (i === 0 && content !== contentBase + versionCount) {
    throw new Error("latest() 返回内容不正确");
  }
}

const latestEnd = performance.now();
const latestTime = latestEnd - latestStart;
rlog.log(`  - 执行 10000 次 latest(): ${latestTime.toFixed(2)}ms`);
rlog.log(`  - 平均每次: ${(latestTime / 10000).toFixed(4)}ms`);

// 测试2: 获取中间版本的性能
const middleVersion = `v${Math.floor(versionCount / 2)}`;
rlog.log(`测试 show('${middleVersion}') 方法性能:`);
const middleStart = performance.now();
for (let i = 0; i < 1000; i++) {
  const content = tv.show(middleVersion);
  if (i === 0 && content !== contentBase + Math.floor(versionCount / 2)) {
    throw new Error(`show('${middleVersion}') 返回内容不正确`);
  }
}
const middleEnd = performance.now();
const middleTime = middleEnd - middleStart;
rlog.log(`  - 执行 1000 次 show(): ${middleTime.toFixed(2)}ms`);
rlog.log(`  - 平均每次: ${(middleTime / 1000).toFixed(4)}ms`);

// 测试3: 获取第一个版本的性能
rlog.log("测试 show('v1') 方法性能:");
const firstStart = performance.now();
for (let i = 0; i < 1000; i++) {
  const content = tv.show("v1");
  if (i === 0 && content !== contentBase + 1) {
    throw new Error("show('v1') 返回内容不正确");
  }
}
const firstEnd = performance.now();
const firstTime = firstEnd - firstStart;
rlog.log(`  - 执行 1000 次 show(): ${firstTime.toFixed(2)}ms`);
rlog.log(`  - 平均每次: ${(firstTime / 1000).toFixed(4)}ms`);

// 测试4: commit 新版本的性能
rlog.log("测试 commit() 方法性能:");
const tv2 = new TextVersion();
for (let i = 1; i <= 100; i++) {
  tv2.commit(contentBase + i, `v${i}`);
}
const commitStart = performance.now();
for (let i = 101; i <= 200; i++) {
  tv2.commit(contentBase + i, `v${i}`);
}
const commitEnd = performance.now();
const commitTime = commitEnd - commitStart;
rlog.log(`  - 提交 100 个版本: ${commitTime.toFixed(2)}ms`);
rlog.log(`  - 平均每次: ${(commitTime / 100).toFixed(4)}ms`);
