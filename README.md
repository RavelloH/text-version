# Text-Version

> 本文档也有[中文版本](docs/README-CN.md)

A lightweight text version management system with differential storage and version rollback capabilities. Similar to Git's version management mechanism, but specifically optimized for text content.

Online preview: https://ravelloh.github.io/text-version

## Features

- **`commit`**: Submit new version (similar to git commit)
- **`show`**: Display specified version content (similar to git show)
- **`log`**: Display version history (similar to git log)
- **`latest`**: Get latest version content
- **`reset`**: Reset to specified version (similar to git reset --hard)
- **`squash`**: Set specified version as snapshot and delete previous versions to reduce storage space

### Storage Format Optimization Features

- **Storage format optimization**: Uses compact differential storage format
- **Duplicate detection**: Automatically avoids storing identical content
- **Version references**: Uses reference syntax to save space for identical content
- **Compression support**: Optional data compression interface
- **Smart differencing**: Uses LCS algorithm to calculate optimal differences
- **Version name deduplication**: Automatically handles duplicate version names by adding # suffixes
- **Optimal storage selection**: Compares all historical versions and automatically selects the storage method with minimum space
- **Hybrid references**: Supports combination of version references and differential operations for further storage efficiency optimization

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
// Create instance
const tv = new TextVersion();

// Submit new version
let storage = tv.commit('', 'Hello, World!', 'v1');
storage = tv.commit(storage, 'Hello, World!\\nThis is the second line.', 'v2');
storage = tv.commit(storage, 'Hello, TypeScript!\\nThis is the second line.');

// View version history
console.log(tv.log(storage));
//[
//  { version: 'v1', isSnapshot: true },
//  { version: 'v2', isSnapshot: false },
//  { version: 'ycdf93', isSnapshot: false }
//]

// View specified version
console.log(tv.show(storage, 'v1')); 
// "Hello, World!"

// View latest version
console.log(tv.latest(storage));
// "Hello, TypeScript!\\nThis is the second line."

console.log(storage);
// :2:v1:Hello, World!
// 2:v2:R13I18:\\nThis is the second line.
// 6:ycdf93:R7D6I11:TypeScript!

// Reset to specified version
storage = tv.reset(storage, 'v2');

// Compress storage space - set v2 as snapshot, delete v1
storage = tv.squash(storage, 'v2'); // v1 version will be permanently deleted, v2 becomes new starting snapshot
```

## Advanced Usage

### Storage Space Optimization

When version history becomes too long, you can use the `squash` method to optimize storage space:

```javascript
const tv = new TextVersion();
let storage = '';

// Create multiple versions
storage = tv.commit(storage, 'First version', 'v1');
storage = tv.commit(storage, 'Second version', 'v2');
storage = tv.commit(storage, 'Third version', 'v3');
storage = tv.commit(storage, 'Fourth version', 'v4');

console.log('Original storage size:', storage.length);
console.log('Version count:', tv.log(storage).length); // 4 versions

// Compress to v2, delete v1
storage = tv.squash(storage, 'v2');

console.log('Compressed storage size:', storage.length);
console.log('Version count:', tv.log(storage).length); // 3 versions: v2, v3, v4

// v1 version has been deleted and cannot be accessed
console.log(tv.show(storage, 'v1')); // null

// v2 and later versions can still be accessed normally
console.log(tv.show(storage, 'v2')); // "Second version"
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

const tv = new TextVersion(compressionProvider);
let storage = tv.commit('', 'This is a very long text...');
console.log(tv.latest(storage));
```

### Storage Format Description

Uses length-prefixed format internally:

```
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
1. **Normal diff**: Difference with previous version `version_name:R6I5:new_content`
2. **Hybrid reference**: Reference to historical version + diff `version_name:=historical_version:R6I5:new_content`

Additionally, the first version is always a snapshot (`:version_name:complete_text`), subsequent versions store differences.

Example:
```
:2:v1:This is original text
2:v2:R4I8:modified content D2
2:v3:=v1:R4I8:modification based on v1
2:v1#:=v1
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
        let storage = '';
        let versionCounter = 1;

        function commitVersion() {
            const text = document.getElementById('input').value;
            const version = `v${versionCounter++}`;
            storage = tv.commit(storage, text, version);
            
            document.getElementById('output').textContent = 
                `Version ${version} committed\nCurrent storage: ${storage}`;
        }

        function showLatest() {
            const latest = tv.latest(storage);
            document.getElementById('output').textContent = 
                `Latest version content:\n${latest}`;
        }

        function showLog() {
            const log = tv.log(storage);
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
new TextVersion(compressionProvider?: CompressionProvider)
```

### API Methods

#### `commit(storage: string, text: string, version?: string): string`
Submit new version, save text changes.
- `storage`: Current storage string
- `text`: Text content to save
- `version`: Optional version name, defaults to content hash

#### `show(storage: string, version: string): string | null`
Display text content of specified version.
- `storage`: Storage string
- `version`: Version name to view
- Returns: Text content, null if version doesn't exist

#### `log(storage: string): VersionInfo[]`
Display version history log, get all version information.
- `storage`: Storage string
- Returns: Array of version information

#### `latest(storage: string): string`
Get text content of latest version.
- `storage`: Storage string
- Returns: Text content of latest version

#### `reset(storage: string, targetVersion: string): string`
Reset to specified version, delete all versions after target version.
- `storage`: Storage string
- `targetVersion`: Version to reset to
- Returns: Storage string after reset

#### `squash(storage: string, targetVersion: string): string`
Set specified version as snapshot and delete previous versions, used to reduce storage space.
- `storage`: Storage string
- `targetVersion`: Version to set as snapshot (all versions before this will be deleted)
- Returns: Compressed storage string

**Note**: This operation is irreversible and will permanently delete all version history before the target version. Suitable for storage space optimization when version history becomes too long.

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

interface DiffOperation {
  type: 'retain' | 'insert' | 'delete';
  length?: number;  // Number of characters for retain and delete operations
  text?: string;    // Text content for insert operations
}
```

## Performance Considerations

- **Space efficiency**: Differential storage significantly reduces storage space, especially for small modifications
- **Time complexity**: Time complexity to get a version depends on the distance from the nearest snapshot to the target version
- **Snapshot strategy**: First version is always a snapshot, subsequent versions store differences
- **Compression**: Can be further optimized through custom compression providers
- **Storage optimization**: Use `squash` method periodically to clean up historical versions and prevent unlimited storage growth

### Best Practices

1. **Periodic compression**: Use `squash` method to compress history when version history becomes too long
2. **Reasonable snapshots**: Consider keeping important milestone versions as snapshots
3. **Batch operations**: Avoid frequent small modifications, try to commit in batches
4. **Version naming**: Use meaningful version names for easier management and compression operations

## License

MIT

## Contributing

Issues and Pull Requests are welcome!
