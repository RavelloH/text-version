# Text-Version

一个轻量级的文本版本管理系统，支持差异存储和版本回滚。类似于Git的版本管理机制，但专门针对文本内容进行了优化。

在线预览：https://ravelloh.github.io/text-version/demo.html

## 特性

- **`commit`**: 提交新版本（类似 git commit）
- **`show`**: 显示指定版本内容（类似 git show）
- **`log`**: 显示版本历史（类似 git log）
- **`latest`**: 获取最新版本内容
- **`reset`**: 重置到指定版本（类似 git reset --hard）
- **`squash`**: 将指定版本设为快照并删除之前的版本，减少存储空间

### 存储格式优化特性

- **存储格式优化**: 使用紧凑的差异存储格式
- **重复检测**: 自动避免存储相同的内容
- **版本引用**: 相同内容使用引用语法节省空间
- **压缩支持**: 可选的数据压缩接口
- **智能差异**: 使用 LCS 算法计算最优差异
- **版本名去重**: 自动处理重复版本名，通过添加#后缀避免冲突
- **最优存储选择**: 对比所有历史版本，自动选择存储空间最小的差异方式
- **混合引用**: 支持版本引用与差异操作的组合，进一步优化存储效率

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
// 创建实例
const tv = new TextVersion();

// 提交新版本
let storage = tv.commit('', '你好，世界！', 'v1');
storage = tv.commit(storage, '你好，世界！\n这是第二行。', 'v2');
storage = tv.commit(storage, '你好，TypeScript！\n这是第二行。');

// 查看版本历史
console.log(tv.log(storage));
//[
//  { version: 'v1', isSnapshot: true },
//  { version: 'v2', isSnapshot: false },
//  { version: 'ycdf93', isSnapshot: false }
//]

// 查看指定版本
console.log(tv.show(storage, 'v1')); 
// "你好，世界！"

// 查看最新版本
console.log(tv.latest(storage));
// "你好，TypeScript！\n这是第二行。"

console.log(storage);
// :2:v1:你好，世界！
// 2:v2:R6I8:\\n这是第二行。
// 6:ycdf93:R3D4I11:TypeScript！


// 重置到指定版本
storage = tv.reset(storage, 'v2');

// 压缩存储空间 - 将v2设为快照，删除v1
storage = tv.squash(storage, 'v2'); // v1版本将被永久删除，v2成为新的起始快照
```

## 高级用法

### 存储空间优化

当版本历史过长时，可以使用 `squash` 方法来优化存储空间：

```javascript
const tv = new TextVersion();
let storage = '';

// 创建多个版本
storage = tv.commit(storage, '第一个版本', 'v1');
storage = tv.commit(storage, '第二个版本', 'v2');
storage = tv.commit(storage, '第三个版本', 'v3');
storage = tv.commit(storage, '第四个版本', 'v4');

console.log('原始存储大小:', storage.length);
console.log('版本数量:', tv.log(storage).length); // 4个版本

// 压缩到v2，删除v1
storage = tv.squash(storage, 'v2');

console.log('压缩后存储大小:', storage.length);
console.log('版本数量:', tv.log(storage).length); // 3个版本: v2, v3, v4

// v1版本已被删除，无法访问
console.log(tv.show(storage, 'v1')); // null

// v2及之后的版本仍可正常访问
console.log(tv.show(storage, 'v2')); // "第二个版本"
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

const tv = new TextVersion(compressionProvider);
let storage = tv.commit('', '这是一段很长的文本...');
console.log(tv.latest(storage));
```

### 存储格式说明

内部使用长度前缀格式存储：

```
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
1. **普通差异**: 与上一个版本的差异 `版本名:R6I5:新内容`
2. **混合引用**: 与历史版本的引用+差异 `版本名:=历史版本:R6I5:新内容`

此外，首个版本总是快照(`:版本名:完整文本`)，后续版本存储差异。

示例：
```
:2:v1:这是原始文本
2:v2:R2I6:修改后的内容D2
2:v3:=v1:R2I6:基于v1的修改
2:v1#:=v1
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
        let storage = '';
        let versionCounter = 1;

        function commitVersion() {
            const text = document.getElementById('input').value;
            const version = `v${versionCounter++}`;
            storage = tv.commit(storage, text, version);
            
            document.getElementById('output').textContent = 
                `版本 ${version} 已提交\n当前存储：${storage}`;
        }

        function showLatest() {
            const latest = tv.latest(storage);
            document.getElementById('output').textContent = 
                `最新版本内容：\n${latest}`;
        }

        function showLog() {
            const log = tv.log(storage);
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
new TextVersion(compressionProvider?: CompressionProvider)
```

### API 方法

#### `commit(storage: string, text: string, version?: string): string`
提交新版本，保存文本更改。
- `storage`: 当前存储字符串
- `text`: 要保存的文本内容
- `version`: 可选的版本名，默认使用内容哈希

#### `show(storage: string, version: string): string | null`
显示指定版本的文本内容。
- `storage`: 存储字符串
- `version`: 要查看的版本名
- 返回: 文本内容，如果版本不存在则返回 null

#### `log(storage: string): VersionInfo[]`
显示版本历史日志，获取所有版本信息。
- `storage`: 存储字符串
- 返回: 版本信息数组

#### `latest(storage: string): string`
获取最新版本的文本内容。
- `storage`: 存储字符串
- 返回: 最新版本的文本内容

#### `reset(storage: string, targetVersion: string): string`
重置到指定版本，删除目标版本之后的所有版本。
- `storage`: 存储字符串
- `targetVersion`: 要重置到的版本
- 返回: 重置后的存储字符串

#### `squash(storage: string, targetVersion: string): string`
将指定版本设为快照并删除之前的版本，用于减少存储空间占用。
- `storage`: 存储字符串
- `targetVersion`: 要设为快照的版本（该版本之前的所有版本将被删除）
- 返回: 压缩后的存储字符串

**注意**: 此操作不可逆，会永久删除目标版本之前的所有版本历史。适用于当版本历史过长时进行存储空间优化。

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

interface DiffOperation {
  type: 'retain' | 'insert' | 'delete';
  length?: number;  // retain和delete操作的字符数
  text?: string;    // insert操作的文本内容
}
```

## 性能考虑

- **空间效率**：差异存储显著减少存储空间，特别是对于小幅修改
- **时间复杂度**：获取版本的时间复杂度取决于从最近快照到目标版本的距离
- **快照策略**：第一个版本总是快照，后续版本存储差异
- **压缩**：可通过自定义压缩提供者进一步优化存储
- **存储优化**：使用 `squash` 方法定期清理历史版本，避免存储空间无限增长

### 最佳实践

1. **定期压缩**：当版本历史过长时，使用 `squash` 方法压缩历史
2. **合理快照**：对于重要的里程碑版本，可以考虑保留为快照
3. **批量操作**：避免频繁的小修改，尽量批量提交
4. **版本命名**：使用有意义的版本名，便于后续管理和压缩操作

## 许可证

MIT

## 贡献

欢迎提交Issue和Pull Request！