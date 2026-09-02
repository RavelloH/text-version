# Text-Version

一个轻量级的文本版本管理系统，支持差异存储和版本回滚。类似于Git的版本管理机制，但专门针对文本内容进行了优化。

在线预览：[https://ravelloh.github.io/text-version](https://ravelloh.github.io/text-version)

## 特性

- **`commit`**: 提交新版本（类似 git commit）
- **`show`**: 显示指定版本内容（类似 git show）
- **`log`**: 显示版本历史（类似 git log）
- **`latest`**: 获取最新版本内容
- **`reset`**: 重置到指定版本（类似 git reset --hard），保留目标版本及之前的所有版本，删除之后的版本
- **`squash`**: 保留目标版本及之后的所有版本，删除之前的版本，减少存储空间

### 存储格式优化特性

- **存储格式优化**: 使用紧凑的差异存储格式
- **重复检测**: 自动避免存储相同的内容
- **版本引用**: 相同内容使用引用语法节省空间
- **压缩支持**: 可选的数据压缩接口
- **智能差异**: 使用 LCS 算法计算最优差异
- **版本名去重**: 自动处理重复版本名，通过添加#后缀避免冲突
- **最优存储选择**: 新快照替换上一版本时，对比直接反向差异和更早版本引用，保留占用空间最小的表示
- **混合引用**: 支持 `=版本:操作序列`，从更早版本应用正向差异还原上一版本，同时保持反向差异读取模型

## 安装

```bash
npm install text-version // or
pnpm install text-version // or
yarn add text-version
```

## 基本用法

### 导入

```javascript
// ES6 模块
import { TextVersion } from 'text-version';

// CommonJS
const { TextVersion } = require('text-version');
```

### 创建实例

```javascript
const tv = new TextVersion();
```

### 使用示例

```javascript
// 导入
import { TextVersion } from 'text-version';
// 或者 CommonJS
// const { TextVersion } = require('text-version');

// 创建实例
const tv = new TextVersion();

// 提交新版本
tv.commit('你好，世界！', 'v1');
tv.commit('你好，世界！\n这是第二行。', 'v2');
tv.commit('你好，TypeScript！\n这是第二行。');

// 查看版本历史
console.log(tv.log());
//[
//  { version: 'v1', isSnapshot: false },  // 差异
//  { version: 'v2', isSnapshot: false },  // 差异
//  { version: 'ycdf93', isSnapshot: true } // 快照（最新）
//]

// 查看指定版本
console.log(tv.show('v1')); 
// "你好，世界！"

// 查看最新版本
console.log(tv.latest());
// "你好，TypeScript！\n这是第二行。"

// 导出版本数据（单体模式 - 默认）
const storage = tv.export();
// 或显式指定单体模式
const storage2 = tv.export("monolithic");
console.log(storage);
// 2:v1:R6D7
// 2:v2:R3D10I2:世界
// :6:ycdf93:你好，TypeScript！\n这是第二行。

// 重置到指定版本
tv.reset('v2');

// 压缩存储空间 - 将v2设为快照，删除v1
tv.squash('v2'); // v1版本将被永久删除，v2成为新的起始快照

// 从现有存储加载
const tv2 = new TextVersion(storage);
console.log(tv2.latest()); // 可以访问保存的数据
```

## 高级用法

### 存储空间优化

当版本历史过长时，可以使用 `squash` 方法来优化存储空间：

```javascript
const tv = new TextVersion();

// 创建多个版本
tv.commit('第一个版本', 'v1');
tv.commit('第二个版本', 'v2');
tv.commit('第三个版本', 'v3');
tv.commit('第四个版本', 'v4');

const storage = tv.export();
console.log('原始存储大小:', storage.length);
console.log('版本数量:', tv.log().length); // 4个版本

// 压缩到v2，删除v1
tv.squash('v2');

const newStorage = tv.export();
console.log('压缩后存储大小:', newStorage.length);
console.log('版本数量:', tv.log().length); // 3个版本: v2, v3, v4

// v1版本已被删除，无法访问
console.log(tv.show('v1')); // null

// v2及之后的版本仍可正常访问
console.log(tv.show('v2')); // "第二个版本"

// 注意：squash后，v4（最新版本）是快照，v2和v3是差异
```

### 自定义压缩

可以提供自定义的压缩算法来进一步减小存储空间：

```javascript
import { TextVersion } from 'text-version';

// 压缩的使用示例
const compressionProvider = {
  compress: (data) => /* 压缩算法 */ data,
  decompress: (data) => /* 解压缩算法 */ data
};

const tv = new TextVersion('', compressionProvider);
tv.commit('这是一段很长的文本...');
console.log(tv.latest());
```

### 分离式存储

当快照内容很大时，可以使用分离式存储来更灵活地管理数据：

```javascript
const tv = new TextVersion();
tv.commit('第一个版本', 'v1');
tv.commit('第二个版本', 'v2');
tv.commit('非常非常非常长的最新版本内容...', 'v3');

// 分离式导出
const result = tv.export("separate");
// result = {
//   metadata: "2:v1:D6I4:原始文本\n2:v2:D5\n:2:v3:##[[abc12345]]##",
//   snapshot: "非常非常非常长的最新版本内容..."
// }
// 注意：##[[abc12345]]## 是快照内容的哈希占位符，用于验证完整性

// metadata 中包含占位符，快照内容单独存储
console.log(result.metadata.length); // 很小
console.log(result.snapshot.length); // 很大

// 使用分离的数据创建实例（自动验证哈希）
const tv2 = new TextVersion(result.metadata, result.snapshot);
console.log(tv2.latest()); // "非常非常非常长的最新版本内容..."

// 如果快照哈希不匹配，会抛出错误（防止数据篡改）
try {
  new TextVersion(result.metadata, '错误的快照内容');
} catch (e) {
  console.error('哈希验证失败'); // 快照内容与metadata中的哈希不匹配
}
```

**使用场景**：

- **大快照内容**：当最新版本内容非常大时，可以将快照单独存储在文件系统或数据库中
- **CDN 优化**：metadata 可以放在 CDN，snapshot 按需加载
- **缓存策略**：可以对 metadata 和 snapshot 使用不同的缓存策略

### 存储格式说明

内部使用长度前缀格式存储。正常提交新版本时，最新版本保存为快照，上一版本在以下方式中选择占用空间最小的一种：

```text
:版本名长度:版本名:内容         (快照版本)
版本名长度:版本名:操作序列      (差异版本)
版本名长度:版本名:=版本名       (版本引用)
版本名长度:版本名:=版本名:操作序列  (混合引用)
```

差异操作格式：

- `R数字` - 保留N个字符
- `I长度:文本` - 插入指定长度的文本
- `D数字` - 删除N个字符

#### 版本名重复处理

当提交版本时发生版本名重复，系统会自动添加#后缀：

- **与上一次版本号重复**: 如果新版本名与最近一次提交的版本名相同，会添加一个#，如 `v1` → `v1#`
- **与之前的版本号重复**: 如果新版本名与历史中任意版本名相同，会根据需要添加多个#，如 `v1` → `v1#` → `v1##`

#### 最优存储选择

系统会自动对比以下存储方式，选择占用空间最小的：

1. **普通差异**: 与上一个版本的反向差异 `版本名:R6I5:旧内容`
2. **混合引用**: 引用更早版本并应用到上一版本的正向差异 `版本名:=历史版本:R6I5:上一版本内容`

**重要**: 反向差异策略下，非重复提交产生的新版本是快照，历史版本存储从新到旧的反向差异。混合引用只允许指向更早版本，因此不会形成循环引用。

示例：

依次commit以下内容：

- 原始文本
- 修改后的内容
- 这是最新的修改后的内容
- 原始文本

结构如下，从后往前看：

```text
2:v1:D6I4:原始文本 // 与"修改后的内容"相比，删除6个字符，插入"原始文本"
2:v2:D5 // 与"这是最新的修改后的内容"相比，删除5个字符得到"修改后的内容"
:2:v3:这是最新的修改后的内容 // v3作为快照版本
2:v4:=v1 // 最新版本就是v1的引用
```

## CDN 使用方式

除了通过 npm 安装，也可以直接通过 CDN 使用：

### 通过 CDN 引入

**注意**: Text-Version 需要 diff-match-patch 库作为依赖，必须在 text-version 脚本之前引入。

```html
<!-- 先引入 diff-match-patch 依赖 -->
<script src="https://cdnjs.cloudflare.com/ajax/libs/diff_match_patch/20121119/diff_match_patch.js"></script>

<!-- 然后引入 text-version UMD 版本 -->
<script src="https://cdn.jsdelivr.net/npm/text-version/dist/index.umd.js"></script>

<!-- 或使用 unpkg CDN -->
<script src="https://cdnjs.cloudflare.com/ajax/libs/diff_match_patch/20121119/diff_match_patch.js"></script>
<script src="https://unpkg.com/text-version/dist/index.umd.js"></script>
```

### 最小示例

```html
<!DOCTYPE html>
<html>
<head>
    <title>Text-Version CDN 示例</title>
</head>
<body>
    <h1>Text-Version 演示</h1>
    <textarea id="input" placeholder="输入文本内容..." rows="5" cols="50">你好，世界！</textarea><br><br>
    <button onclick="commitVersion()">提交版本</button>
    <button onclick="showLatest()">显示最新版本</button>
    <button onclick="showLog()">显示版本日志</button><br><br>
    
    <div>
        <h3>输出：</h3>
        <pre id="output"></pre>
    </div>

    <!-- 先引入 diff-match-patch 依赖 -->
    <script src="https://cdnjs.cloudflare.com/ajax/libs/diff_match_patch/20121119/diff_match_patch.js"></script>
    <!-- 然后引入 text-version -->
    <script src="https://cdn.jsdelivr.net/npm/text-version/dist/index.umd.js"></script>
    <script>
        // TextVersion 通过全局变量 window.TextVersion 可用
        const tv = new window.TextVersion.TextVersion();
        let versionCounter = 1;

        function commitVersion() {
            const text = document.getElementById('input').value;
            const version = `v${versionCounter++}`;
            tv.commit(text, version);
            
            document.getElementById('output').textContent = 
                `版本 ${version} 已提交\n当前存储：${tv.export()}`;
        }

        function showLatest() {
            const latest = tv.latest();
            document.getElementById('output').textContent = 
                `最新版本内容：\n${latest}`;
        }

        function showLog() {
            const log = tv.log();
            const logText = log.map(info => 
                `${info.version} (${info.isSnapshot ? '快照' : '差异'})`
            ).join('\n');
            
            document.getElementById('output').textContent = 
                `版本历史：\n${logText}`;
        }
    </script>
</body>
</html>
```

## API 参考

### TextVersion

#### 构造函数

```typescript
new TextVersion(initialStorage?: string, compressionProvider?: CompressionProvider, options?: TextVersionOptions)
new TextVersion(metadata: string, snapshot: string, compressionProvider?: CompressionProvider, options?: TextVersionOptions)
```

**参数：**

**普通导入：**

- `initialStorage` (可选): 要加载的初始版本数据字符串
- `compressionProvider` (可选): 自定义压缩提供者

可选的 `options` 参数可以关闭最优差异选择，用于进行基准对比：

```javascript
const baseline = new TextVersion(undefined, undefined, {
  optimizeDiffStorage: false
});
```

**分离式导入：**

- `metadata`: 版本记录字符串（包含占位符）
- `snapshot`: 快照内容字符串
- `compressionProvider` (可选): 自定义压缩提供者

**注意**：分离式导入时，会验证快照内容的哈希值。如果不匹配，会抛出错误。

### API 方法

#### `commit(text: string, version?: string): this`

提交新版本，保存文本更改。

- `text`: 要保存的文本内容
- `version`: 可选的版本名，默认使用内容哈希
- 返回: `this` 支持方法链

#### `show(version: string): string | null`

显示指定版本的文本内容。

- `version`: 要查看的版本名
- 返回: 文本内容，如果版本不存在则返回 null

#### `log(): VersionInfo[]`

显示版本历史日志，获取所有版本信息。

- 返回: 版本信息数组

#### `latest(): string`

获取最新版本的文本内容。

- 返回: 最新版本的文本内容

#### `reset(targetVersion: string): this`

重置到指定版本，**保留目标版本及之前的所有版本**，删除目标版本之后的所有版本。

- `targetVersion`: 要重置到的版本（保留）
- 返回: `this` 支持方法链

**注意**: 重置后，目标版本会自动变成快照（因为它成为最新版本），之前的版本会被转换为差异存储。

#### `squash(targetVersion: string): this`

**保留目标版本及之后的所有版本**，删除目标版本之前的所有版本，用于减少存储空间占用。

- `targetVersion`: 保留的起始版本（保留，该版本之前的所有版本将被删除）
- 返回: `this` 支持方法链

**注意**: 此操作不可逆，会永久删除目标版本之前（早于目标版本）的所有版本历史。

#### `export(mode?: "monolithic" | "separate"): string | { metadata: string; snapshot: string }`

导出当前的版本数据。

- `mode` (可选): 导出模式
  - `"monolithic"`: 单体模式，返回完整的版本数据字符串（默认）
  - `"separate"`: 分离式存储，返回包含 `metadata` 和 `snapshot` 的对象
  - 未提供时默认为 `"monolithic"`
- 返回:
  - 单体模式：返回完整的版本数据字符串
  - 分离模式：返回包含 `metadata` 和 `snapshot` 的对象

**分离式导出说明**：

- `metadata`: 版本记录字符串，快照内容被替换为 `##[[hash]]##` 占位符
- `snapshot`: 最新版本的完整快照内容
- `hash`: 8位短哈希，用于验证快照内容的完整性

### 类型定义

```typescript
interface VersionInfo {
  version: string;      // 版本名
  isSnapshot: boolean;  // 是否为快照版本
}

interface CompressionProvider {
  compress(data: string): string;
  decompress(data: string): string;
}

interface TextVersionOptions {
  optimizeDiffStorage?: boolean; // 默认开启；可关闭以进行基准对比
}

interface DiffOperation {
  type: 'retain' | 'insert' | 'delete';
  length?: number;  // retain和delete操作的字符数
  text?: string;    // insert操作的文本内容
}
```

## 性能考虑

- **空间效率**：差异存储显著减少存储空间，特别是对于小幅修改
- **时间复杂度**：
  - **最新版本**：O(1) 时间复杂度（直接读取快照）⚡
  - **历史版本**：需要从最新快照反向应用差异，时间取决于版本距离
- **快照策略**：非重复提交的最新版本是快照；相同内容可以使用引用，历史版本使用反向差异或安全的混合引用
- **压缩**：可通过自定义压缩提供者进一步优化存储
- **存储优化**：使用 `squash` 方法定期清理历史版本，避免存储空间无限增长
- **适用场景**：特别适合频繁访问最新版本的应用（如实时编辑器、协同文档）
- **基准测试**：运行 `pnpm tsx tests/performance-test.ts`，可对比最优存储与仅相邻反向差异策略在提交和读取场景下的指标

### 最佳实践

1. **定期压缩**：当版本历史过长时，使用 `squash` 方法压缩历史
2. **合理快照**：对于重要的里程碑版本，可以考虑保留为快照
3. **批量操作**：避免频繁的小修改，尽量批量提交
4. **版本命名**：使用有意义的版本名，便于后续管理和压缩操作

## 许可证

MIT

## 贡献

欢迎提交Issue和Pull Request！
