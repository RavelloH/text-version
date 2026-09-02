# Text-Version

> 本文档也有[中文版本](docs/README-CN.md)

A lightweight text version management system with differential storage and version rollback capabilities. Similar to Git's version management mechanism, but specifically optimized for text content.

Online preview: [https://ravelloh.github.io/text-version](https://ravelloh.github.io/text-version)

## Features

- **`commit`**: Submit new version (similar to git commit)
- **`show`**: Display specified version content (similar to git show)
- **`log`**: Display version history (similar to git log)
- **`latest`**: Get latest version content
- **`reset`**: Reset to specified version (similar to git reset --hard), keep the target version and all versions before it, delete versions after it
- **`squash`**: Keep the target version and all versions after it, delete versions before it to reduce storage space

### Storage Format Optimization Features

- **Storage format optimization**: Uses compact differential storage format
- **Duplicate detection**: Automatically avoids storing identical content
- **Version references**: Uses reference syntax to save space for identical content
- **Compression support**: Optional data compression interface
- **Smart differencing**: Uses LCS algorithm to calculate optimal differences
- **Version name deduplication**: Automatically handles duplicate version names by adding # suffixes
- **Optimal storage selection**: When a new snapshot replaces the previous version, compares its direct reverse diff with references to earlier versions and keeps the shortest representation
- **Hybrid references**: Supports `=version:operations`, applying operations to an earlier version to reconstruct the previous version while preserving reverse-diff reads

## Installation

```bash
npm install text-version // or
pnpm install text-version // or
yarn add text-version
```

## Basic Usage

### Import

```javascript
// ES6 modules
import { TextVersion } from 'text-version';

// CommonJS
const { TextVersion } = require('text-version');
```

### Create Instance

```javascript
const tv = new TextVersion();
```

### Usage Example

```javascript
// Import
import { TextVersion } from 'text-version';
// Or CommonJS
// const { TextVersion } = require('text-version');

// Create instance
const tv = new TextVersion();

// Submit new version
tv.commit('Hello, World!', 'v1');
tv.commit('Hello, World!\\nThis is the second line.', 'v2');
tv.commit('Hello, TypeScript!\\nThis is the second line.');

// View version history
console.log(tv.log());
//[
//  { version: 'v1', isSnapshot: false },  // diff
//  { version: 'v2', isSnapshot: false },  // diff
//  { version: 'ycdf93', isSnapshot: true } // snapshot (latest)
//]

// View specified version
console.log(tv.show('v1')); 
// "Hello, World!"

// View latest version
console.log(tv.latest());
// "Hello, TypeScript!\\nThis is the second line."

// Export version data (monolithic mode - default)
const storage = tv.export();
// Or explicitly specify monolithic mode
const storage2 = tv.export("monolithic");
console.log(storage);
// 2:v1:R6D7
// 2:v2:R3D10I2:world
// :6:ycdf93:hello, TypeScript！\nThis is the second line.

// Reset to specified version
tv.reset('v2');

// Compress storage space - set v2 as snapshot, delete v1
tv.squash('v2'); // v1 version will be permanently deleted, v2 becomes new starting snapshot

// Load from existing storage
const tv2 = new TextVersion(storage);
console.log(tv2.latest()); // Can access the saved data
```

## Advanced Usage

### Storage Space Optimization

When version history becomes too long, you can use the `squash` method to optimize storage space:

```javascript
const tv = new TextVersion();

// Create multiple versions
tv.commit('First version', 'v1');
tv.commit('Second version', 'v2');
tv.commit('Third version', 'v3');
tv.commit('Fourth version', 'v4');

const storage = tv.export();
console.log('Original storage size:', storage.length);
console.log('Version count:', tv.log().length); // 4 versions

// Compress to v2, delete v1
tv.squash('v2');

const newStorage = tv.export();
console.log('Compressed storage size:', newStorage.length);
console.log('Version count:', tv.log().length); // 3 versions: v2, v3, v4

// v1 version has been deleted and cannot be accessed
console.log(tv.show('v1')); // null

// v2 and later versions can still be accessed normally
console.log(tv.show('v2')); // "Second version"

// Note: After squash, v4 (latest version) is a snapshot, v2 and v3 are diffs
```

### Custom Compression

You can provide custom compression algorithms to further reduce storage space:

```javascript
import { TextVersion } from 'text-version';

// Compression usage example
const compressionProvider = {
  compress: (data) => /* compression algorithm */ data,
  decompress: (data) => /* decompression algorithm */ data
};

const tv = new TextVersion('', compressionProvider);
tv.commit('This is a very long text...');
console.log(tv.latest());
```

### Separate Storage

When snapshot content is very large, you can use separate storage for more flexible data management:

```javascript
const tv = new TextVersion();
tv.commit('First version', 'v1');
tv.commit('Second version', 'v2');
tv.commit('Very very very long latest version content...', 'v3');

// Separate export
const result = tv.export("separate");
// result = {
//   metadata: "2:v1:D6I4:original text\n2:v2:D5\n:2:v3:##[[abc12345]]##",
//   snapshot: "Very very very long latest version content..."
// }
// Note: ##[[abc12345]]## is a hash placeholder for snapshot content, used for integrity verification

// metadata contains placeholder, snapshot stored separately
console.log(result.metadata.length); // small
console.log(result.snapshot.length); // large

// Create instance with separated data (auto-validates hash)
const tv2 = new TextVersion(result.metadata, result.snapshot);
console.log(tv2.latest()); // "Very very very long latest version content..."

// Error will be thrown if snapshot hash doesn't match (prevents data tampering)
try {
  new TextVersion(result.metadata, 'wrong snapshot content');
} catch (e) {
  console.error('Hash validation failed'); // Snapshot content doesn't match hash in metadata
}
```

**Use Cases**:

- **Large snapshot content**: When latest version content is very large, snapshot can be stored separately in filesystem or database
- **CDN optimization**: metadata can be served from CDN, snapshot loaded on demand
- **Cache strategy**: Use different cache strategies for metadata and snapshot

### Storage Format Description

Uses length-prefixed format internally. For a normal new commit, the newest version is stored as a snapshot and the previous version is represented by the shortest available option:

```text
:version_name_length:version_name:content         (snapshot version)
version_name_length:version_name:operation_sequence      (diff version)
version_name_length:version_name:=version_name       (version reference)
version_name_length:version_name:=version_name:operation_sequence  (hybrid reference)
```

Diff operation format:

- `R number` - Retain N characters
- `I length:text` - Insert text of specified length
- `D number` - Delete N characters

#### Version Name Duplication Handling

When version name duplication occurs during submission, the system automatically adds # suffixes:

- **Duplicate with latest version name**: If the new version name is the same as the most recent submission, adds one #, e.g., `v1` → `v1#`
- **Duplicate with previous version name**: If the new version name is the same as any historical version name, adds multiple # as needed, e.g., `v1` → `v1#` → `v1##`

#### Optimal Storage Selection

The system automatically compares the following storage methods and selects the one with minimum space:

1. **Normal diff**: Reverse difference with previous version `version_name:R6I5:old_content`
2. **Hybrid reference**: Reference to an earlier version + forward diff to the previous version `version_name:=historical_version:R6I5:previous_content`

**Important**: Under the reverse-diff strategy, a newly submitted non-duplicate latest version is a snapshot, while historical versions store reverse diffs from new to old. A hybrid reference only points to an earlier version, so it cannot form a cycle.

Example:

```text
2:v1:R8D8I13:original text  # v1 is reverse diff (from v2 to v1)
2:v2:R4I8:modified content D2  # v2 is reverse diff (from v3 to v2)
:2:v3:This is latest modified content  # v3 is snapshot (latest version)
2:v1#:=v1  # Reference to v1
```

## CDN Usage

Besides npm installation, you can also use directly via CDN:

### Include via CDN

**Note**: Text-Version requires the diff-match-patch library as a dependency. You need to include it before the text-version script.

```html
<!-- Include diff-match-patch dependency first -->
<script src="https://cdnjs.cloudflare.com/ajax/libs/diff_match_patch/20121119/diff_match_patch.js"></script>

<!-- Then include text-version UMD version -->
<script src="https://cdn.jsdelivr.net/npm/text-version/dist/index.umd.js"></script>

<!-- Or using unpkg CDN -->
<script src="https://cdnjs.cloudflare.com/ajax/libs/diff_match_patch/20121119/diff_match_patch.js"></script>
<script src="https://unpkg.com/text-version/dist/index.umd.js"></script>
```

### Minimal Example

```html
<!DOCTYPE html>
<html>
<head>
    <title>Text-Version CDN Example</title>
</head>
<body>
    <h1>Text-Version Demo</h1>
    <textarea id="input" placeholder="Enter text content..." rows="5" cols="50">Hello, World!</textarea><br><br>
    <button onclick="commitVersion()">Commit Version</button>
    <button onclick="showLatest()">Show Latest</button>
    <button onclick="showLog()">Show Log</button><br><br>
    
    <div>
        <h3>Output:</h3>
        <pre id="output"></pre>
    </div>

    <!-- Include diff-match-patch dependency first -->
    <script src="https://cdnjs.cloudflare.com/ajax/libs/diff_match_patch/20121119/diff_match_patch.js"></script>
    <!-- Then include text-version -->
    <script src="https://cdn.jsdelivr.net/npm/text-version/dist/index.umd.js"></script>
    <script>
        // TextVersion available through global variable window.TextVersion
        const tv = new window.TextVersion.TextVersion();
        let versionCounter = 1;

        function commitVersion() {
            const text = document.getElementById('input').value;
            const version = `v${versionCounter++}`;
            tv.commit(text, version);
            
            document.getElementById('output').textContent = 
                `Version ${version} committed\nCurrent storage: ${tv.export()}`;
        }

        function showLatest() {
            const latest = tv.latest();
            document.getElementById('output').textContent = 
                `Latest version content:\n${latest}`;
        }

        function showLog() {
            const log = tv.log();
            const logText = log.map(info => 
                `${info.version} (${info.isSnapshot ? 'snapshot' : 'diff'})`
            ).join('\n');
            
            document.getElementById('output').textContent = 
                `Version history:\n${logText}`;
        }
    </script>
</body>
</html>
```

## API Reference

### TextVersion

#### Constructor

```typescript
new TextVersion(initialStorage?: string, compressionProvider?: CompressionProvider, options?: TextVersionOptions)
new TextVersion(metadata: string, snapshot: string, compressionProvider?: CompressionProvider, options?: TextVersionOptions)
```

**Parameters:**

**Normal Import:**

- `initialStorage` (optional): Initial version data string to load
- `compressionProvider` (optional): Custom compression provider

The optional `options` argument can disable optimal diff selection for a baseline comparison:

```javascript
const baseline = new TextVersion(undefined, undefined, {
  optimizeDiffStorage: false
});
```

**Separate Import:**

- `metadata`: Version record string (containing placeholder)
- `snapshot`: Snapshot content string
- `compressionProvider` (optional): Custom compression provider

**Note**: When using separate import, the hash value of snapshot content will be validated. An error will be thrown if it doesn't match.

### API Methods

#### `commit(text: string, version?: string): this`

Submit new version, save text changes.

- `text`: Text content to save
- `version`: Optional version name, defaults to content hash
- Returns: `this` for method chaining

#### `show(version: string): string | null`

Display text content of specified version.

- `version`: Version name to view
- Returns: Text content, null if version doesn't exist

#### `log(): VersionInfo[]`

Display version history log, get all version information.

- Returns: Array of version information

#### `latest(): string`

Get text content of latest version.

- Returns: Text content of latest version

#### `reset(targetVersion: string): this`

Reset to specified version, **keep the target version and all versions before it**, delete all versions after the target version.

- `targetVersion`: Version to reset to (kept)
- Returns: `this` for method chaining

**Note**: After reset, the target version automatically becomes a snapshot (as it becomes the latest version), and previous versions are converted to differential storage.

#### `squash(targetVersion: string): this`

**Keep the target version and all versions after it**, delete all versions before the specified version, used to reduce storage space.

- `targetVersion`: Starting version to keep (kept, all versions before this will be deleted)
- Returns: `this` for method chaining

**Note**: This operation is irreversible and will permanently delete all version history before the target version. After squash, the **latest version** becomes a snapshot, while the target version and intermediate versions are stored as diffs. Suitable for storage space optimization when version history becomes too long.

#### `export(mode?: "monolithic" | "separate"): string | { metadata: string; snapshot: string }`

Export current version data.

- `mode` (optional): Export mode
  - `"monolithic"`: Monolithic mode, returns complete version data string (default)
  - `"separate"`: Separate storage, returns object containing `metadata` and `snapshot`
  - Defaults to `"monolithic"` when not provided
- Returns:
  - Monolithic mode: Complete version data string
  - Separate mode: Object containing `metadata` and `snapshot`

**Separate Export Explanation**:

- `metadata`: Version record string, snapshot content replaced with `##[[hash]]##` placeholder
- `snapshot`: Complete snapshot content of latest version
- `hash`: 8-character short hash for validating snapshot content integrity

### Type Definitions

```typescript
interface VersionInfo {
  version: string;      // Version name
  isSnapshot: boolean;  // Whether it's a snapshot version
}

interface CompressionProvider {
  compress(data: string): string;
  decompress(data: string): string;
}

interface TextVersionOptions {
  optimizeDiffStorage?: boolean; // Enabled by default; disable for baseline comparisons
}

interface DiffOperation {
  type: 'retain' | 'insert' | 'delete';
  length?: number;  // Number of characters for retain and delete operations
  text?: string;    // Text content for insert operations
}
```

## Performance Considerations

- **Space efficiency**: Differential storage significantly reduces storage space, especially for small modifications
- **Time complexity**:
  - **Latest version**: O(1) time complexity (direct snapshot read) ⚡
  - **Historical versions**: Requires reverse application of diffs from latest snapshot, time depends on version distance
- **Snapshot strategy**: A non-duplicate latest version is a snapshot; identical content may use a reference, while historical versions use reverse diffs or safe hybrid references
- **Compression**: Can be further optimized through custom compression providers
- **Storage optimization**: Use `squash` method periodically to clean up historical versions and prevent unlimited storage growth
- **Use cases**: Particularly suitable for applications that frequently access the latest version (e.g., real-time editors, collaborative documents)
- **Benchmark**: Run `pnpm tsx tests/performance-test.ts` to compare optimized and adjacent-diff-only storage across commit and read workloads

### Best Practices

1. **Periodic compression**: Use `squash` method to compress history when version history becomes too long
2. **Reasonable snapshots**: Consider keeping important milestone versions as snapshots
3. **Batch operations**: Avoid frequent small modifications, try to commit in batches
4. **Version naming**: Use meaningful version names for easier management and compression operations

## License

MIT

## Contributing

Issues and Pull Requests are welcome!
