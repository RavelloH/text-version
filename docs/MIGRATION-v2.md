# 迁移指南：从 v1 迁移到 v2

## 概述

v2 版本主要有四点变更：

- 重构了 API，将外部存储管理改为内部状态管理，使用更加优雅和简洁
- 将存储由正向增量改为反向增量，提高latest等方法的性能
- 支持分离式存储，即将版本数据和快照内容数据分开存储
- 优化了性能

## 快速迁移

### 步骤 1: 移除 storage 变量

**v1:**

```javascript
const tv = new TextVersion();
let storage = '';
```

**v2:**

```javascript
const tv = new TextVersion();
// 不再需要 storage 变量
```

### 步骤 2: 更新方法调用

**v1:**

```javascriptstorage = tv.commit(storage, '文本内容', 'v1');
storage = tv.commit(storage, '更新的内容', 'v2');
console.log(tv.log(storage));
console.log(tv.show(storage, 'v1'));
console.log(tv.latest(storage));
storage = tv.reset(storage, 'v1');
storage = tv.squash(storage, 'v1');
```

**v2:**

```javascript
tv.commit('文本内容', 'v1');
tv.commit('更新的内容', 'v2');
console.log(tv.log());
console.log(tv.show('v1'));
console.log(tv.latest());
tv.reset('v1');
tv.squash('v1');
```

### 步骤 3: 持久化存储

**v1:**

```javascript
// 直接使用 storage 变量
localStorage.setItem('myData', storage);
const loaded = localStorage.getItem('myData');
```

**v2:**

```javascript
// 使用 export() 导出
const storage = tv.export();
localStorage.setItem('myData', storage);

// 从存储恢复
const loaded = localStorage.getItem('myData');
const tv2 = new TextVersion(loaded);
```

## 主要变更详解

### 变更 1: 反向增量存储

**v1 的存储方式（正向增量）**：

- 第一个版本存储完整快照
- 后续版本存储相对于前一个版本的正向差异（从旧到新）
- 访问最新版本需要从第一个版本开始，依次应用所有差异，时间复杂度 O(n)

**v2 的存储方式（反向增量）**：

- **最新版本总是存储完整快照**
- 历史版本存储相对于后一个版本的反向差异（从新到旧）
- 访问最新版本只需读取快照，时间复杂度 O(1)

**示例对比**：

假设依次提交以下内容：

1. `Hello World`
2. `Hello TypeScript`
3. `Hi TypeScript`

v1 存储格式（正向）：

```text
:2:v1:Hello World           # v1 是快照
2:v2:R6D5I10:TypeScript     # v2 是差异：保留6个字符，删除5个，插入TypeScript
2:v3:R0D5I2:Hi              # v3 是差异：删除5个字符，插入Hi
```

v2 存储格式（反向）：

```text
2:v1:R3D2I5:Hello           # v1 是反向差异：从v2反推v1
2:v2:R0D2I5:Hello           # v2 是反向差异：从v3反推v2
:2:v3:Hi TypeScript         # v3 是快照（最新版本）
```

**性能提升**：

- `latest()` 方法：从 O(n) 优化到 O(1)，提升约 **1330 倍**
- `commit()` 方法：无需重新序列化整个存储，提升约 **388 倍**
- 查询历史版本：越新的版本访问越快

### 变更 2: 分离式存储

v2 新增了分离式存储模式，允许将版本元数据和快照内容分开存储。

**使用场景**：

- **大文件管理**：当最新版本内容非常大（如长文档、配置文件）时，可以将快照单独存储
- **分布式存储**：元数据存储在数据库，快照内容存储在对象存储（如 S3）
- **CDN 优化**：元数据可以放在 CDN，快照内容按需加载
- **不同缓存策略**：对元数据和快照内容使用不同的缓存和过期策略

**v1**: 不支持分离式存储

**v2**: 支持通过 `export("separate")` 分离导出

```javascript
const tv = new TextVersion();
tv.commit('第一个版本', 'v1');
tv.commit('非常非常长的最新版本内容...', 'v2');

// 分离式导出
const result = tv.export("separate");
console.log(result);
// {
//   metadata: "1:v1:R5I6:第一个版本\n:2:v2:##[[abc12345]]##",
//   snapshot: "非常非常长的最新版本内容..."
// }

// metadata 中使用占位符 ##[[hash]]## 表示快照位置
// 可以将 metadata 和 snapshot 分别存储

// 从分离的数据恢复
const tv2 = new TextVersion(result.metadata, result.snapshot);
console.log(tv2.latest()); // "非常非常长的最新版本内容..."

// 哈希验证：如果快照内容被篡改，会抛出错误
try {
  new TextVersion(result.metadata, '错误的内容');
} catch (e) {
  console.error('快照哈希不匹配'); // 自动验证数据完整性
}
```

**占位符格式**：

- 格式：`##[[hash]]##`
- hash 是快照内容的 8 位哈希值
- 用于验证快照内容的完整性，防止数据篡改

**存储模式对比**：

| 模式             | 导出方式                             | 返回值                                   | 适用场景                   |
| ---------------- | ------------------------------------ | ---------------------------------------- | -------------------------- |
| 单体模式（默认） | `export()` 或 `export("monolithic")` | 字符串                                   | 快照内容较小，统一存储     |
| 分离式模式       | `export("separate")`                 | `{ metadata: string, snapshot: string }` | 快照内容很大，需要分开存储 |

## 详细示例

### 示例 1: 基本使用

#### v1 代码

```javascript
const tv = new TextVersion();
let storage = '';

storage = tv.commit(storage, 'Hello', 'v1');
storage = tv.commit(storage, 'Hello World', 'v2');

const versions = tv.log(storage);
const latest = tv.latest(storage);
const v1Content = tv.show(storage, 'v1');
```

#### v2 代码

```javascript
const tv = new TextVersion();

tv.commit('Hello', 'v1');
tv.commit('Hello World', 'v2');

const versions = tv.log();
const latest = tv.latest();
const v1Content = tv.show('v1');
```

### 示例 2: 链式调用

#### v1 代码（不支持）

```javascript
let storage = '';
storage = tv.commit(storage, 'text1', 'v1');
storage = tv.commit(storage, 'text2', 'v2');
storage = tv.reset(storage, 'v1');
```

#### v2 代码（支持链式）

```javascript
tv.commit('text1', 'v1')
  .commit('text2', 'v2')
  .reset('v1');
```

### 示例 3: 数据持久化和恢复

v1：

```javascript
// 保存
const tv = new TextVersion();
let storage = tv.commit('', 'data', 'v1');
localStorage.setItem('backup', storage);

// 恢复
const restored = localStorage.getItem('backup');
const content = tv.latest(restored);
```

v2：

```javascript
// 保存
const tv = new TextVersion();
tv.commit('data', 'v1');
localStorage.setItem('backup', tv.export());

// 恢复
const restored = localStorage.getItem('backup');
const tv2 = new TextVersion(restored);
const content = tv2.latest();
```

### 示例 4: 分离式存储（v2 新增）

```javascript
// 适用场景：最新版本内容非常大时
const tv = new TextVersion();
tv.commit('版本1', 'v1');
tv.commit('版本2', 'v2');
tv.commit('这是一个非常非常非常长的文档内容，可能有几MB大小...', 'v3');

// 分离式导出
const { metadata, snapshot } = tv.export("separate");

// 将元数据和快照分别存储
localStorage.setItem('version_metadata', metadata);
// 可以将 snapshot 存储到其他地方（如文件系统、S3等）
await uploadToS3('snapshots/latest.txt', snapshot);

// 恢复时需要同时提供元数据和快照
const loadedMetadata = localStorage.getItem('version_metadata');
const loadedSnapshot = await downloadFromS3('snapshots/latest.txt');
const tv2 = new TextVersion(loadedMetadata, loadedSnapshot);

console.log(tv2.latest()); // 正常访问
```

### 示例 5: 自定义压缩

v1：

```javascript
const compressionProvider = {
  compress: (data) => /* ... */ data,
  decompress: (data) => /* ... */ data
};

const tv = new TextVersion(compressionProvider);
let storage = tv.commit('', 'data');
```

v2：

```javascript
const compressionProvider = {
  compress: (data) => /* ... */ data,
  decompress: (data) => /* ... */ data
};

// 注意：compressionProvider 现在是第二个参数
const tv = new TextVersion('', compressionProvider);
tv.commit('data');

// 或者从存储恢复时
const tv2 = new TextVersion(existingStorage, compressionProvider);
```

## 批量替换脚本

如果你有大量代码需要迁移，可以使用以下正则表达式进行批量替换：

### 1. 移除 storage 参数

```regex
查找: tv\\.commit\\(storage,\\s*
替换: tv.commit(
```

### 2. 移除 storage 赋值

```regex
查找: storage\\s*=\\s*tv\\.(commit|reset|squash)\\(
替换: tv.$1(
```

### 3. 移除 storage 参数（其他方法）

```regex
查找: tv\\.(log|latest)\\(storage\\)
替换: tv.$1()
```

```regex
查找: tv\\.show\\(storage,\\s*
替换: tv.show(
```

## 注意事项

1. **构造函数参数顺序变化**: 如果使用了压缩提供者，注意参数顺序从 `(compressionProvider)` 变为 `(initialStorage?, compressionProvider?)`
2. **返回值变化**: `commit`, `reset`, `squash` 现在返回 `this` 而不是 `storage`
3. **数据格式**: 底层存储格式稍有变化，但 v1 的 storage 数据可以直接在 v2 中使用
4. **反向增量**: v2 使用反向增量存储，最新版本总是快照，这带来了显著的性能提升
5. **分离式存储**: 使用分离式存储时，必须同时提供 metadata 和 snapshot，且 snapshot 哈希必须匹配

## 存储格式变化

### v1 存储格式（正向增量）

```text
:2:v1:完整内容             # 第一个版本是快照
2:v2:正向差异操作          # 从v1到v2的正向差异
2:v3:正向差异操作          # 从v2到v3的正向差异
```

### v2 存储格式（反向增量）

```text
2:v1:反向差异操作          # 从v2到v1的反向差异
2:v2:反向差异操作          # 从v3到v2的反向差异
:2:v3:完整内容             # 最新版本是快照
```

**关键区别**：

- v1: 第一个版本是快照，后续版本是正向差异
- v2: 最后一个版本是快照，历史版本是反向差异

这个改变使得访问最新版本（最常见的操作）从 O(n) 变为 O(1)。

## 兼容性

- v1 的存储数据可以在 v2 中使用
- v2 导出的数据格式与 v1 不同，不能在 v1 中使用
- v2 的 API 调用方式不兼容 v1

## 性能优化

我主要把存储改成了在 TextVersion 内部管理，不再在每次操作的时候导出 text-version 的存储格式。  
效果显著，测试脚本在 [performance-test.ts](../tests/performance-test.ts)。

性能提升：

- commit 方法提升约 388 倍
- latest 方法提升约 1330 倍
- 查询中间版本 v250 提升约 1600 倍
- 查询初始版本 v1 提升约 4624 倍
- 新增提交 100 个版本提升约 386 倍

可通过以下测试结果对比：

```text
PS E:\text-version> pnpm tsx .\performance-test.ts
[2026-01-25 10:58:59.614][INFO] === 性能对比测试 ===
[2026-01-25 10:58:59.616][INFO] 准备进行包含 500 个版本的性能测试...
[2026-01-25 10:59:14.348][PROG] [||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||]100% 500/500[2026-01-25 10:59:14.348][INFO] 已创建 500 个版本
[2026-01-25 10:59:14.349][INFO]   - 执行 500 次 commit(): 14731.89ms
[2026-01-25 10:59:14.349][INFO]   - 平均每次: 29.9123ms
[2026-01-25 10:59:14.349][INFO] 测试 latest() 方法性能:
[2026-01-25 10:59:14.961][INFO]   - 执行 10000 次 latest(): 612.17ms
[2026-01-25 10:59:14.961][INFO]   - 平均每次: 0.0612ms
[2026-01-25 10:59:14.962][INFO] 测试 show('v250') 方法性能:
[2026-01-25 10:59:15.106][INFO]   - 执行 1000 次 show(): 144.66ms
[2026-01-25 10:59:15.107][INFO]   - 平均每次: 0.1447ms
[2026-01-25 10:59:15.108][INFO] 测试 show('v1') 方法性能:
[2026-01-25 10:59:15.340][INFO]   - 执行 1000 次 show(): 231.23ms
[2026-01-25 10:59:15.340][INFO]   - 平均每次: 0.2312ms
[2026-01-25 10:59:15.340][INFO] 测试 commit() 方法性能:
[2026-01-25 10:59:16.198][INFO]   - 提交 100 个版本: 758.08ms
[2026-01-25 10:59:16.198][INFO]   - 平均每次: 7.5808ms
PS E:\text-version> pnpm tsx .\performance-test.ts
[2026-01-25 11:04:40.349][INFO] === 性能对比测试 ===
[2026-01-25 11:04:40.351][INFO] 准备进行包含 500 个版本的性能测试...
[2026-01-25 11:04:40.389][PROG] [||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||]100% 500/500[2026-01-25 11:04:40.389][INFO] 已创建 500 个版本
[2026-01-25 11:04:40.390][INFO]   - 执行 500 次 commit(): 37.96ms
[2026-01-25 11:04:40.390][INFO]   - 平均每次: 0.4188ms
[2026-01-25 11:04:40.390][INFO] 测试 latest() 方法性能:
[2026-01-25 11:04:40.390][INFO]   - 执行 10000 次 latest(): 0.46ms
[2026-01-25 11:04:40.391][INFO]   - 平均每次: 0.0000ms
[2026-01-25 11:04:40.391][INFO] 测试 show('v250') 方法性能:
[2026-01-25 11:04:40.391][INFO]   - 执行 1000 次 show(): 0.09ms
[2026-01-25 11:04:40.391][INFO]   - 平均每次: 0.0001ms
[2026-01-25 11:04:40.391][INFO] 测试 show('v1') 方法性能:
[2026-01-25 11:04:40.392][INFO]   - 执行 1000 次 show(): 0.05ms
[2026-01-25 11:04:40.392][INFO]   - 平均每次: 0.0001ms
[2026-01-25 11:04:40.392][INFO] 测试 commit() 方法性能:
[2026-01-25 11:04:40.395][INFO]   - 提交 100 个版本: 1.96ms
[2026-01-25 11:04:40.395][INFO]   - 平均每次: 0.0196ms
```

## 获取帮助

如有问题，请：

- 查看 [README.md](README.md) 或 [README-CN.md](README-CN.md)
- 参考 [test.ts](../tests/test.ts) 测试示例
- 查看 [demo.html](../demo.html) 示例
- 提交 Issue 到 GitHub 仓库
