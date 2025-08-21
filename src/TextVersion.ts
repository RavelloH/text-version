import { diff_match_patch } from 'diff-match-patch';

/**
 * 差异操作类型
 */
export interface DiffOperation {
  type: 'retain' | 'insert' | 'delete';
  length?: number;
  text?: string;
}

/**
 * 版本信息
 */
export interface VersionInfo {
  version: string;
  isSnapshot: boolean;
}

/**
 * 压缩和解压缩接口
 */
export interface CompressionProvider {
  compress(data: string): string;
  decompress(data: string): string;
}

/**
 * 文本版本管理系统的主类
 */
export class TextVersion {
  private compressionProvider?: CompressionProvider;
  private dmp: InstanceType<typeof diff_match_patch>;

  constructor(compressionProvider?: CompressionProvider) {
    this.compressionProvider = compressionProvider;
    // 在UMD环境中，diff_match_patch直接就是构造函数
    if (typeof window !== 'undefined' && (window as any).diff_match_patch) {
      this.dmp = new (window as any).diff_match_patch();
    } else {
      this.dmp = new diff_match_patch();
    }
  }

  /**
   * 提交新版本
   * @param storage 当前存储字符串
   * @param text 新的文本内容
   * @param version 版本名（可选，默认使用哈希）
   * @returns 新的存储字符串
   */
  commit(storage: string, text: string, version?: string): string {
    const decompressed = this.decompress(storage);
    const parsedData = this.parseStorage(decompressed);
    
    // 生成版本名，处理重复版本名
    let versionName: string;
    if (version) {
      versionName = this.resolveVersionName(parsedData.versions, version);
    } else {
      versionName = this.generateHash(text);
      versionName = this.resolveVersionName(parsedData.versions, versionName);
    }

    // 检查是否与历史版本内容相同（用于版本引用）
    for (const existingVersion of parsedData.versions) {
      const existingText = this.getVersionText(decompressed, existingVersion);
      if (existingText === text) {
        // 内容与历史版本相同，使用版本引用
        return this.addVersionReference(storage, existingVersion, versionName);
      }
    }

    // 添加新版本
    parsedData.versions.push(versionName);

    if (parsedData.versions.length === 1) {
      // 第一个版本，存储完整文本
      parsedData.snapshots[versionName] = text;
    } else {
      // 对于非第一个版本，只考虑差异存储，与所有历史版本进行对比，选择最优的差异方式
      const bestStorage = this.findBestDiffOption(parsedData, text, versionName, decompressed);
      parsedData.deltas[versionName] = bestStorage.content;
    }

    const newStorage = this.serializeStorage(parsedData);
    return this.compress(newStorage);
  }

  /**
   * 添加版本引用
   */
  private addVersionReference(storage: string, referencedVersion: string, newVersionName: string): string {
    const decompressed = this.decompress(storage);
    const parsedData = this.parseStorage(decompressed);
    
    // 添加版本引用
    parsedData.versions.push(newVersionName);
    
    // 使用引用语法：直接使用 = 表示引用，不重复版本名
    parsedData.deltas[newVersionName] = `=${referencedVersion}`;
    
    const newStorage = this.serializeStorage(parsedData);
    return this.compress(newStorage);
  }

  /**
   * 显示指定版本的内容
   * @param storage 存储字符串
   * @param version 版本名
   * @returns 版本内容，如果版本不存在则返回null
   */
  show(storage: string, version: string): string | null {
    const decompressed = this.decompress(storage);
    return this.getVersionText(decompressed, version);
  }

  /**
   * 显示版本历史日志
   * @param storage 存储字符串
   * @returns 版本信息数组
   */
  log(storage: string): VersionInfo[] {
    const decompressed = this.decompress(storage);
    const parsedData = this.parseStorage(decompressed);
    
    return parsedData.versions.map(v => ({
      version: v,
      isSnapshot: !!parsedData.snapshots[v]
    }));
  }

  /**
   * 重置到指定版本，删除之后的版本
   * @param storage 存储字符串
   * @param targetVersion 目标版本
   * @returns 新的存储字符串
   */
  reset(storage: string, targetVersion: string): string {
    const decompressed = this.decompress(storage);
    const parsedData = this.parseStorage(decompressed);
    
    const targetIndex = parsedData.versions.indexOf(targetVersion);
    if (targetIndex === -1) {
      throw new Error(`版本 ${targetVersion} 不存在`);
    }

    // 保留目标版本及之前的版本
    const keepVersions = parsedData.versions.slice(0, targetIndex + 1);
    const newParsedData = {
      versions: keepVersions,
      snapshots: {} as Record<string, string>,
      deltas: {} as Record<string, string>
    };

    // 保留需要的快照和增量
    for (const v of keepVersions) {
      if (parsedData.snapshots[v]) {
        newParsedData.snapshots[v] = parsedData.snapshots[v];
      }
      if (parsedData.deltas[v]) {
        newParsedData.deltas[v] = parsedData.deltas[v];
      }
    }

    const newStorage = this.serializeStorage(newParsedData);
    return this.compress(newStorage);
  }

  /**
   * 获取最新版本的文本
   * @param storage 存储字符串
   * @returns 最新版本的文本内容，如果没有版本则返回空字符串
   */
  latest(storage: string): string {
    const decompressed = this.decompress(storage);
    const parsedData = this.parseStorage(decompressed);
    
    if (parsedData.versions.length === 0) {
      return '';
    }

    const latestVersion = parsedData.versions[parsedData.versions.length - 1];
    return this.getVersionText(decompressed, latestVersion) || '';
  }

  /**
   * 将指定版本设为快照并删除之前的版本
   * @param storage 存储字符串
   * @param targetVersion 要设为快照的版本
   * @returns 压缩后的新存储字符串
   */
  squash(storage: string, targetVersion: string): string {
    const decompressed = this.decompress(storage);
    const parsedData = this.parseStorage(decompressed);
    
    const targetIndex = parsedData.versions.indexOf(targetVersion);
    if (targetIndex === -1) {
      throw new Error(`版本 ${targetVersion} 不存在`);
    }

    // 获取目标版本的完整文本内容
    const targetText = this.getVersionText(decompressed, targetVersion);
    if (targetText === null) {
      throw new Error(`无法获取版本 ${targetVersion} 的内容`);
    }

    // 创建新的解析数据，从目标版本开始
    const newParsedData = {
      versions: parsedData.versions.slice(targetIndex),
      snapshots: {} as Record<string, string>,
      deltas: {} as Record<string, string>
    };

    // 将目标版本设为快照
    newParsedData.snapshots[targetVersion] = targetText;

    // 保留目标版本之后的版本
    for (let i = targetIndex + 1; i < parsedData.versions.length; i++) {
      const version = parsedData.versions[i];
      if (parsedData.snapshots[version]) {
        newParsedData.snapshots[version] = parsedData.snapshots[version];
      } else if (parsedData.deltas[version]) {
        newParsedData.deltas[version] = parsedData.deltas[version];
      }
    }

    const newStorage = this.serializeStorage(newParsedData);
    return this.compress(newStorage);
  }

  /**
   * 生成文本的哈希值作为版本名
   */
  private generateHash(text: string): string {
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // 转换为32位整数
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * 解决版本名重复问题，通过添加#后缀
   * @param existingVersions 现有版本列表
   * @param proposedVersion 建议的版本名
   * @returns 唯一的版本名
   */
  private resolveVersionName(existingVersions: string[], proposedVersion: string): string {
    if (!existingVersions.includes(proposedVersion)) {
      return proposedVersion;
    }
    
    // 版本名重复，添加#后缀
    let candidate = proposedVersion + '#';
    while (existingVersions.includes(candidate)) {
      candidate += '#';
    }
    return candidate;
  }

  /**
   * 寻找最优的差异存储选项（仅限差异，不包括快照）
   * @param parsedData 解析的存储数据
   * @param text 新的文本内容
   * @param versionName 新版本名
   * @param decompressedStorage 解压缩的存储字符串
   * @returns 最优差异存储选项
   */
  private findBestDiffOption(
    parsedData: { versions: string[]; snapshots: Record<string, string>; deltas: Record<string, string> },
    text: string,
    versionName: string,
    decompressedStorage: string
  ): { content: string } {
    const options: Array<{ content: string; length: number }> = [];
    
    // 选项1: 与上一个版本的差异
    // 注意：parsedData.versions已经包含了新版本，所以上一个版本是倒数第二个
    if (parsedData.versions.length > 1) {
      const latestVersion = parsedData.versions[parsedData.versions.length - 2]; // 倒数第二个
      const latestText = this.getVersionText(decompressedStorage, latestVersion) || '';
      const diff = this.calculateDiff(latestText, text);
      const diffContent = this.encodeDiff(diff);
      const serialized = `${versionName.length}:${versionName}:${this.escapeString(diffContent)}`;
      options.push({
        content: diffContent,
        length: serialized.length
      });
    }
    
    // 选项2: 与其他历史版本的混合差异
    // 排除最后一个版本（新版本）和倒数第二个版本（已在选项1中处理）
    for (let i = 0; i < parsedData.versions.length - 2; i++) {
      const baseVersion = parsedData.versions[i];
      const baseText = this.getVersionText(decompressedStorage, baseVersion) || '';
      const diff = this.calculateDiff(baseText, text);
      const diffContent = this.encodeDiff(diff);
      const hybridContent = `=${baseVersion}:${diffContent}`;
      const serialized = `${versionName.length}:${versionName}:${this.escapeString(hybridContent)}`;
      options.push({
        content: hybridContent,
        length: serialized.length
      });
    }
    
    // 选择最短的选项
    options.sort((a, b) => a.length - b.length);
    return options[0];
  }

  /**
   * 计算两个文本之间的差异 - 使用diff-match-patch库
   */
  private calculateDiff(oldText: string, newText: string): DiffOperation[] {
    // 如果完全相同，返回retain所有
    if (oldText === newText) {
      return oldText.length > 0 ? [{ type: 'retain', length: oldText.length }] : [];
    }
    
    // 如果旧文本为空，直接插入新文本
    if (oldText.length === 0) {
      return newText.length > 0 ? [{ type: 'insert', text: newText }] : [];
    }
    
    // 如果新文本为空，删除所有旧文本
    if (newText.length === 0) {
      return [{ type: 'delete', length: oldText.length }];
    }
    
    // 使用diff-match-patch计算差异
    const diffs = this.dmp.diff_main(oldText, newText);
    this.dmp.diff_cleanupSemantic(diffs);
    
    // 转换为我们的DiffOperation格式
    return this.convertDmpDiffsToOperations(diffs);
  }

  /**
   * 将diff-match-patch的差异转换为我们的操作格式
   */
  private convertDmpDiffsToOperations(diffs: Array<[number, string]>): DiffOperation[] {
    const operations: DiffOperation[] = [];
    
    for (const [operation, data] of diffs) {
      switch (operation) {
        case 0: // EQUAL - 保留
          if (data.length > 0) {
            operations.push({ type: 'retain', length: data.length });
          }
          break;
        case -1: // DELETE - 删除
          if (data.length > 0) {
            operations.push({ type: 'delete', length: data.length });
          }
          break;
        case 1: // INSERT - 插入
          if (data.length > 0) {
            operations.push({ type: 'insert', text: data });
          }
          break;
      }
    }
    
    return this.optimizeSimpleOperations(operations);
  }

  /**
   * 简化的操作优化
   */
  private optimizeSimpleOperations(operations: DiffOperation[]): DiffOperation[] {
    // 移除空操作
    return operations.filter(op => {
      if (op.type === 'retain' || op.type === 'delete') {
        return op.length && op.length > 0;
      }
      if (op.type === 'insert') {
        return op.text && op.text.length > 0;
      }
      return false;
    });
  }

  /**
   * 获取公共前缀长度
   */
  private getCommonPrefixLength(str1: string, str2: string): number {
    let i = 0;
    const minLen = Math.min(str1.length, str2.length);
    while (i < minLen && str1[i] === str2[i]) {
      i++;
    }
    return i;
  }

  /**
   * 获取公共后缀长度  
   */
  private getCommonSuffixLength(str1: string, str2: string): number {
    let i = 0;
    const minLen = Math.min(str1.length, str2.length);
    while (i < minLen && str1[str1.length - 1 - i] === str2[str2.length - 1 - i]) {
      i++;
    }
    return i;
  }

  /**
   * 将差异操作编码为字符串
   */
  private encodeDiff(operations: DiffOperation[]): string {
    // 省略末尾的retain操作，因为applyDiff会自动保留剩余文本
    const opsToEncode = [...operations];
    while (opsToEncode.length > 0 && opsToEncode[opsToEncode.length - 1].type === 'retain') {
      opsToEncode.pop();
    }
    
    return opsToEncode.map(op => {
      switch (op.type) {
        case 'retain':
          return `R${op.length}`;
        case 'delete':
          return `D${op.length}`;
        case 'insert':
          return `I${op.text!.length}:${op.text!}`;
        default:
          throw new Error(`未知操作类型: ${(op as any).type}`);
      }
    }).join('');
  }

  /**
   * 解析差异操作字符串
   */
  private decodeDiff(encoded: string): DiffOperation[] {
    const operations: DiffOperation[] = [];
    let i = 0;

    while (i < encoded.length) {
      const opType = encoded[i];
      i++;

      if (opType === 'R' || opType === 'D') {
        // 读取数字
        let numStr = '';
        while (i < encoded.length && /\d/.test(encoded[i])) {
          numStr += encoded[i];
          i++;
        }
        const length = parseInt(numStr);
        operations.push({
          type: opType === 'R' ? 'retain' : 'delete',
          length
        });
      } else if (opType === 'I') {
        // 读取长度
        let lengthStr = '';
        while (i < encoded.length && encoded[i] !== ':') {
          lengthStr += encoded[i];
          i++;
        }
        i++; // 跳过冒号
        const length = parseInt(lengthStr);
        const text = encoded.substring(i, i + length);
        i += length;
        operations.push({
          type: 'insert',
          text: text
        });
      }
    }

    return operations;
  }

  /**
   * 应用差异操作到文本
   */
  private applyDiff(text: string, operations: DiffOperation[]): string {
    let result = '';
    let textIndex = 0;

    for (const op of operations) {
      switch (op.type) {
        case 'retain':
          result += text.substring(textIndex, textIndex + op.length!);
          textIndex += op.length!;
          break;
        case 'delete':
          textIndex += op.length!;
          break;
        case 'insert':
          result += op.text!;
          break;
      }
    }

    // 如果还有剩余的原文本未处理，且没有更多的删除操作，则自动保留到结尾
    // 这处理了省略末尾retain操作的情况
    if (textIndex < text.length) {
      result += text.substring(textIndex);
    }

    return result;
  }

  /**
   * 获取指定版本的文本内容
   */
  private getVersionText(decompressedStorage: string, version: string): string | null {
    const parsedData = this.parseStorage(decompressedStorage);
    
    if (!parsedData.versions.includes(version)) {
      return null;
    }

    // 如果是快照版本，直接返回
    if (parsedData.snapshots[version]) {
      return parsedData.snapshots[version];
    }

    // 如果是版本引用或混合引用，解析引用
    if (parsedData.deltas[version] && parsedData.deltas[version].includes('=')) {
      const referenceData = parsedData.deltas[version];
      const equalIndex = referenceData.indexOf('=');
      
      if (equalIndex === 0) {
        // 格式：=版本名 表示引用指定版本
        const colonIndex = referenceData.indexOf(':', 1);
        if (colonIndex !== -1) {
          // 格式：=版本名:差异操作 表示混合引用
          const referencedVersion = referenceData.substring(1, colonIndex);
          const diffOperations = referenceData.substring(colonIndex + 1);
          const baseText = this.getVersionText(decompressedStorage, referencedVersion) || '';
          const operations = this.decodeDiff(diffOperations);
          return this.applyDiff(baseText, operations);
        } else {
          // 格式：=版本名 表示纯引用
          const referencedVersion = referenceData.substring(1);
          return this.getVersionText(decompressedStorage, referencedVersion);
        }
      }
    }

    // 找到最近的快照
    const versionIndex = parsedData.versions.indexOf(version);
    let baseText = '';
    let baseIndex = -1;

    for (let i = versionIndex; i >= 0; i--) {
      const v = parsedData.versions[i];
      if (parsedData.snapshots[v]) {
        baseText = parsedData.snapshots[v];
        baseIndex = i;
        break;
      }
    }

    // 应用从快照到目标版本的所有增量
    let currentText = baseText;
    for (let i = baseIndex + 1; i <= versionIndex; i++) {
      const v = parsedData.versions[i];
      if (parsedData.deltas[v] && !parsedData.deltas[v].includes('=')) {
        const operations = this.decodeDiff(parsedData.deltas[v]);
        currentText = this.applyDiff(currentText, operations);
      }
    }

    return currentText;
  }

  /**
   * 解析存储格式
   */
  private parseStorage(storage: string): {
    versions: string[];
    snapshots: Record<string, string>;
    deltas: Record<string, string>;
  } {
    const result = {
      versions: [] as string[],
      snapshots: {} as Record<string, string>,
      deltas: {} as Record<string, string>
    };

    if (!storage.trim()) {
      return result;
    }

    const lines = storage.split('\n').filter(line => line.trim());
    
    for (const line of lines) {
      if (line.startsWith(':')) {
        // 快照版本: :版本名长度:版本名:内容
        const withoutColon = line.substring(1); // 移除开头的冒号
        const firstColon = withoutColon.indexOf(':');
        if (firstColon === -1) continue;

        const versionNameLength = parseInt(withoutColon.substring(0, firstColon));
        if (isNaN(versionNameLength)) continue;

        const versionName = withoutColon.substring(firstColon + 1, firstColon + 1 + versionNameLength);
        const remainingPart = withoutColon.substring(firstColon + 1 + versionNameLength);

        if (!remainingPart.startsWith(':')) continue;

        const content = remainingPart.substring(1); // 跳过冒号
        result.versions.push(versionName);
        result.snapshots[versionName] = this.unescapeString(content);
      } else {
        // 差异版本: 版本名长度:版本名:操作序列
        const firstColon = line.indexOf(':');
        if (firstColon === -1) continue;

        const versionNameLength = parseInt(line.substring(0, firstColon));
        if (isNaN(versionNameLength)) continue;

        const versionName = line.substring(firstColon + 1, firstColon + 1 + versionNameLength);
        const remainingPart = line.substring(firstColon + 1 + versionNameLength);

        if (!remainingPart.startsWith(':')) continue;

        const contentPart = remainingPart.substring(1); // 跳过冒号
        
        // 检查是否是版本引用（包含=号）
        if (contentPart.includes('=')) {
          // 版本引用格式：版本名= 或 新版本名=被引用版本名
          result.versions.push(versionName);
          result.deltas[versionName] = this.unescapeString(contentPart);
        } else {
          // 普通差异版本
          result.versions.push(versionName);
          result.deltas[versionName] = this.unescapeString(contentPart);
        }
      }
    }

    return result;
  }

  /**
   * 序列化存储格式
   */
  private serializeStorage(data: {
    versions: string[];
    snapshots: Record<string, string>;
    deltas: Record<string, string>;
  }): string {
    const lines: string[] = [];

    for (const version of data.versions) {
      if (data.snapshots[version]) {
        // 快照版本: :版本名长度:版本名:内容
        const content = this.escapeString(data.snapshots[version]);
        lines.push(`:${version.length}:${version}:${content}`);
      } else if (data.deltas[version]) {
        // 差异版本: 版本名长度:版本名:操作序列
        const delta = this.escapeString(data.deltas[version]);
        lines.push(`${version.length}:${version}:${delta}`);
      }
    }

    return lines.join('\n');
  }

  /**
   * 转义特殊字符
   */
  private escapeString(str: string): string {
    return str
      .replace(/\\/g, '\\\\')
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r')
      .replace(/\t/g, '\\t');
  }

  /**
   * 反转义特殊字符
   */
  private unescapeString(str: string): string {
    return str
      .replace(/\\t/g, '\t')
      .replace(/\\r/g, '\r')
      .replace(/\\n/g, '\n')
      .replace(/\\\\/g, '\\');
  }

  /**
   * 压缩数据
   */
  private compress(data: string): string {
    return this.compressionProvider ? this.compressionProvider.compress(data) : data;
  }

  /**
   * 解压缩数据
   */
  private decompress(data: string): string {
    return this.compressionProvider ? this.compressionProvider.decompress(data) : data;
  }
}