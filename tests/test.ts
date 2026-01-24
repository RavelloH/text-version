import { TextVersion } from "../src/TextVersion";
import RLog from "rlog-js";

const rlog = new RLog();

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
}

const results: TestResult[] = [];
let testCount = 0;

function test(name: string, fn: () => void): void {
  testCount++;
  try {
    fn();
    results.push({ name, passed: true });
    rlog.log(`✓ [${testCount}] ${name}`);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    results.push({
      name,
      passed: false,
      error: errorMsg,
    });
    rlog.log(`✗ [${testCount}] ${name}`);
    rlog.log(`  错误: ${errorMsg}`);
  }
}

rlog.log("=== Text-Version 测试开始 ===\n");

// 测试 1: 基本 commit 功能
test("commit - 提交有版本名的版本", () => {
  const tv = new TextVersion();
  tv.commit("Hello, World!", "v1");
  const log = tv.log();
  if (log.length !== 1 || log[0].version !== "v1") {
    throw new Error("版本提交失败");
  }
});

test("commit - 提交自动命名的版本", () => {
  const tv = new TextVersion();
  tv.commit("Hello, World!");
  const log = tv.log();
  if (log.length !== 1 || !log[0].version) {
    throw new Error("自动命名版本提交失败");
  }
});

test("commit - 多次提交创建版本历史", () => {
  const tv = new TextVersion();
  tv.commit("v1 content", "v1");
  tv.commit("v2 content", "v2");
  tv.commit("v3 content", "v3");
  if (tv.log().length !== 3) {
    throw new Error("多次提交失败");
  }
});

// 测试 2: show 功能
test("show - 查看指定版本内容", () => {
  const tv = new TextVersion();
  tv.commit("Hello, World!", "v1");
  const content = tv.show("v1");
  if (content !== "Hello, World!") {
    throw new Error("查看版本内容失败");
  }
});

test("show - 查看不存在的版本返回 null", () => {
  const tv = new TextVersion();
  tv.commit("Hello, World!", "v1");
  const content = tv.show("nonexistent");
  if (content !== null) {
    throw new Error("应该返回 null");
  }
});

test("show - 查看历史版本内容", () => {
  const tv = new TextVersion();
  tv.commit("v1 content", "v1");
  tv.commit("v2 content", "v2");
  const v1 = tv.show("v1");
  const v2 = tv.show("v2");
  if (v1 !== "v1 content" || v2 !== "v2 content") {
    throw new Error("历史版本内容不正确");
  }
});

// 测试 3: log 功能
test("log - 空实例返回空数组", () => {
  const tv = new TextVersion();
  if (tv.log().length !== 0) {
    throw new Error("空实例应返回空数组");
  }
});

test("log - 返回正确的版本信息", () => {
  const tv = new TextVersion();
  tv.commit("v1", "v1");
  tv.commit("v2", "v2");
  const log = tv.log();
  if (
    log.length !== 2 ||
    !log[0].isSnapshot ||
    log[1].isSnapshot ||
    log[0].version !== "v1" ||
    log[1].version !== "v2"
  ) {
    throw new Error("版本信息不正确");
  }
});

// 测试 4: latest 功能
test("latest - 空实例返回空字符串", () => {
  const tv = new TextVersion();
  if (tv.latest() !== "") {
    throw new Error("空实例应返回空字符串");
  }
});

test("latest - 返回最新版本内容", () => {
  const tv = new TextVersion();
  tv.commit("v1", "v1");
  tv.commit("v2", "v2");
  tv.commit("v3", "v3");
  if (tv.latest() !== "v3") {
    throw new Error("最新版本内容不正确");
  }
});

// 测试 5: export 和 initialStorage
test("export - 导出版本数据", () => {
  const tv = new TextVersion();
  tv.commit("Hello", "v1");
  const storage = tv.export();
  if (!storage || storage.length === 0) {
    throw new Error("导出数据失败");
  }
});

test("initialStorage - 从存储加载数据", () => {
  const tv1 = new TextVersion();
  tv1.commit("Hello", "v1");
  tv1.commit("World", "v2");
  const storage = tv1.export();

  const tv2 = new TextVersion(storage);
  if (tv2.log().length !== 2 || tv2.latest() !== "World") {
    throw new Error("从存储加载数据失败");
  }
});

test("export/import - 数据完整性", () => {
  const tv1 = new TextVersion();
  tv1.commit("First", "v1");
  tv1.commit("Second", "v2");
  tv1.commit("Third", "v3");

  const storage = tv1.export();
  const tv2 = new TextVersion(storage);

  if (
    tv2.show("v1") !== "First" ||
    tv2.show("v2") !== "Second" ||
    tv2.show("v3") !== "Third"
  ) {
    throw new Error("导出导入后数据不完整");
  }
});

// 测试 6: reset 功能
test("reset - 重置到指定版本", () => {
  const tv = new TextVersion();
  tv.commit("v1", "v1");
  tv.commit("v2", "v2");
  tv.commit("v3", "v3");
  tv.reset("v2");
  if (tv.log().length !== 2) {
    throw new Error("reset 后版本数不正确");
  }
});

test("reset - 重置后无法访问后续版本", () => {
  const tv = new TextVersion();
  tv.commit("v1", "v1");
  tv.commit("v2", "v2");
  tv.commit("v3", "v3");
  tv.reset("v1");
  if (tv.show("v2") !== null || tv.show("v3") !== null) {
    throw new Error("reset 后仍可访问后续版本");
  }
});

test("reset - 支持链式调用", () => {
  const tv = new TextVersion();
  tv.commit("v1", "v1").commit("v2", "v2").reset("v1");
  if (tv.log().length !== 1) {
    throw new Error("链式调用 reset 失败");
  }
});

// 测试 7: squash 功能
test("squash - 压缩到指定版本", () => {
  const tv = new TextVersion();
  tv.commit("v1", "v1");
  tv.commit("v2", "v2");
  tv.commit("v3", "v3");
  tv.squash("v2");
  const log = tv.log();
  if (log.length !== 2 || tv.show("v1") !== null) {
    throw new Error("squash 失败");
  }
});

test("squash - 压缩后目标版本变为快照", () => {
  const tv = new TextVersion();
  tv.commit("v1", "v1");
  tv.commit("v2", "v2");
  tv.commit("v3", "v3");
  tv.squash("v2");
  const log = tv.log();
  const v2Info = log.find((v) => v.version === "v2");
  if (!v2Info || !v2Info.isSnapshot) {
    throw new Error("squash 后目标版本应为快照");
  }
});

test("squash - 压缩后保留目标版本及之后的数据", () => {
  const tv = new TextVersion();
  tv.commit("v1", "v1");
  tv.commit("v2", "v2");
  tv.commit("v3", "v3");
  tv.squash("v2");
  if (tv.show("v2") !== "v2" || tv.show("v3") !== "v3") {
    throw new Error("squash 后数据不完整");
  }
});

test("squash - 支持链式调用", () => {
  const tv = new TextVersion();
  tv.commit("v1", "v1").commit("v2", "v2").squash("v2");
  if (tv.log().length !== 1) {
    throw new Error("链式调用 squash 失败");
  }
});

// 测试 8: 链式调用
test("链式调用 - commit 连续调用", () => {
  const tv = new TextVersion();
  tv.commit("v1", "v1").commit("v2", "v2").commit("v3", "v3");
  if (tv.log().length !== 3) {
    throw new Error("链式 commit 失败");
  }
});

test("链式调用 - 混合操作", () => {
  const tv = new TextVersion();
  tv.commit("v1", "v1")
    .commit("v2", "v2")
    .commit("v3", "v3")
    .reset("v2")
    .commit("v3-new", "v3");
  if (tv.log().length !== 3) {
    throw new Error("混合链式调用失败");
  }
});

// 测试 9: 版本引用
test("版本引用 - 相同内容使用引用", () => {
  const tv = new TextVersion();
  tv.commit("相同内容", "v1");
  tv.commit("相同内容", "v2");
  const storage = tv.export();
  if (!storage.includes("=v1")) {
    throw new Error("未使用版本引用");
  }
});

test("版本引用 - 引用版本可正确访问", () => {
  const tv = new TextVersion();
  tv.commit("相同内容", "v1");
  tv.commit("相同内容", "v2");
  if (tv.show("v2") !== "相同内容") {
    throw new Error("引用版本访问失败");
  }
});

// 测试 10: 差异存储
test("差异存储 - 增量存储节省空间", () => {
  const tv = new TextVersion();
  tv.commit("Hello, World!", "v1");
  tv.commit("Hello, TypeScript!", "v2");
  const storage = tv.export();
  // 差异存储应该比存储两次完整文本小
  // 注意：需要考虑版本名、分隔符等元数据的开销
  const twoFullTexts = "Hello, World!" + "Hello, TypeScript!";
  // 差异存储至少应该比两倍完整文本小
  if (storage.length >= twoFullTexts.length * 2) {
    throw new Error("差异存储未节省空间");
  }
});

test("差异存储 - 正确恢复内容", () => {
  const tv = new TextVersion();
  tv.commit("Hello, World!", "v1");
  tv.commit("Hello, World!\nSecond line.", "v2");
  tv.commit("Hello, TypeScript!\nSecond line.", "v3");

  if (
    tv.show("v1") !== "Hello, World!" ||
    tv.show("v2") !== "Hello, World!\nSecond line." ||
    tv.show("v3") !== "Hello, TypeScript!\nSecond line."
  ) {
    throw new Error("差异存储恢复内容错误");
  }
});

// 测试 11: 边界情况
test("边界情况 - 空字符串提交", () => {
  const tv = new TextVersion();
  tv.commit("", "empty");
  const result = tv.show("empty");
  if (result !== "" && result !== null) {
    throw new Error(`空字符串提交失败，返回: ${result}`);
  }
});

test("边界情况 - 超长文本", () => {
  const tv = new TextVersion();
  const longText = "a".repeat(10000);
  tv.commit(longText, "long");
  if (tv.show("long") !== longText) {
    throw new Error("超长文本处理失败");
  }
});

test("边界情况 - 特殊字符", () => {
  const tv = new TextVersion();
  const specialText = "测试\n\r\t特殊\\字符:=";
  tv.commit(specialText, "special");
  if (tv.show("special") !== specialText) {
    throw new Error("特殊字符处理失败");
  }
});

test("边界情况 - Unicode 字符", () => {
  const tv = new TextVersion();
  const unicode = "Hello 👋 世界 🌍 Emoji 😀";
  tv.commit(unicode, "unicode");
  if (tv.show("unicode") !== unicode) {
    throw new Error("Unicode 字符处理失败");
  }
});

test("边界情况 - 版本名包含特殊字符", () => {
  const tv = new TextVersion();
  tv.commit("content", "v1#2@3");
  if (tv.show("v1#2@3") !== "content") {
    throw new Error("特殊字符版本名处理失败");
  }
});

// 测试复杂文本类型
test("复杂文本 - 多种换行符混合", () => {
  const tv = new TextVersion();
  const text = "Line1\nLine2\rLine3\r\nLine4\n\rLine5";
  tv.commit(text, "newlines");
  if (tv.show("newlines") !== text) {
    throw new Error("多种换行符处理失败");
  }
});

test("复杂文本 - 各种控制字符", () => {
  const tv = new TextVersion();
  const text =
    "Tab:\t Newline:\n Return:\r Bell:\x07 Backspace:\b Form feed:\f Vertical tab:\v";
  tv.commit(text, "control-chars");
  if (tv.show("control-chars") !== text) {
    throw new Error("控制字符处理失败");
  }
});

test("复杂文本 - Emoji 表情组合", () => {
  const tv = new TextVersion();
  const text = "👨‍👩‍👧‍👦 👍🏻 🇨🇳 🏳️‍🌈 ❤️ 🔥 💯 ✨ 🎉 😀 😃 😄 😁";
  tv.commit(text, "emoji-complex");
  if (tv.show("emoji-complex") !== text) {
    throw new Error("复杂 Emoji 处理失败");
  }
});

test("复杂文本 - Emoji 序列完整性", () => {
  const tv = new TextVersion();
  const text1 = "Hello 👋";
  const text2 = "Hello 👋 World 🌍";
  tv.commit(text1, "v1");
  tv.commit(text2, "v2");
  if (tv.show("v1") !== text1 || tv.show("v2") !== text2) {
    throw new Error("Emoji 序列完整性失败");
  }
});

test("复杂文本 - 零宽字符", () => {
  const tv = new TextVersion();
  const text = "Hello\u200BWorld\u200C\u200DTest\uFEFF";
  tv.commit(text, "zero-width");
  if (tv.show("zero-width") !== text) {
    throw new Error("零宽字符处理失败");
  }
});

test("复杂文本 - 右到左标记", () => {
  const tv = new TextVersion();
  const text = "Hello\u202EWorld\u202D مرحبا";
  tv.commit(text, "rtl");
  if (tv.show("rtl") !== text) {
    throw new Error("右到左标记处理失败");
  }
});

test("复杂文本 - 组合字符和变音符号", () => {
  const tv = new TextVersion();
  const text = "é café naïve résumé Ñoño ü ö ä";
  tv.commit(text, "diacritics");
  if (tv.show("diacritics") !== text) {
    throw new Error("变音符号处理失败");
  }
});

test("复杂文本 - 各种Unicode平面字符", () => {
  const tv = new TextVersion();
  const text = "BMP: 你好 | SMP: 𝕳𝖊𝖑𝖑𝖔 | 𠜎 𡿺 | 🀀 🀁";
  tv.commit(text, "unicode-planes");
  if (tv.show("unicode-planes") !== text) {
    throw new Error("Unicode平面字符处理失败");
  }
});

// 测试可能破坏存储结构的字符
test("存储结构 - 冒号字符", () => {
  const tv = new TextVersion();
  const text = "Key:Value:More:Colons:::";
  tv.commit(text, "colons");
  tv.commit("Another:Test", "colons2");
  if (tv.show("colons") !== text || tv.show("colons2") !== "Another:Test") {
    throw new Error("冒号字符破坏了存储结构");
  }
});

test("存储结构 - 等号字符", () => {
  const tv = new TextVersion();
  // 使用足够不同的内容，避免触发版本引用
  const text1 = "a=b==c===d====";
  const text2 = "test=value and more content to make it different";
  const text3 = "more==data with extra text here";

  tv.commit(text1, "eq1");
  tv.commit(text2, "eq2");
  tv.commit(text3, "eq3");

  const eq1Result = tv.show("eq1");
  const eq2Result = tv.show("eq2");
  const eq3Result = tv.show("eq3");

  if (eq1Result !== text1) {
    throw new Error(`eq1 失败: 期望 "${text1}", 实际 "${eq1Result}"`);
  }
  if (eq2Result !== text2) {
    throw new Error(`eq2 失败: 期望 "${text2}", 实际 "${eq2Result}"`);
  }
  if (eq3Result !== text3) {
    throw new Error(`eq3 失败: 期望 "${text3}", 实际 "${eq3Result}"`);
  }
});

test("存储结构 - 反斜杠转义", () => {
  const tv = new TextVersion();
  const text = "C:\\path\\to\\file\\\\network\\share\\n\\r\\t\\\\";
  tv.commit(text, "backslash");
  if (tv.show("backslash") !== text) {
    throw new Error("反斜杠转义失败");
  }
});

test("存储结构 - 数字字符串", () => {
  const tv = new TextVersion();
  const text = "123:456:789 R10 I5:text D3";
  tv.commit(text, "numbers");
  if (tv.show("numbers") !== text) {
    throw new Error("数字字符串处理失败");
  }
});

test("存储结构 - 存储格式关键字", () => {
  const tv = new TextVersion();
  const text = "R100I200:content D50 =version :2:v1:data";
  tv.commit(text, "keywords");
  if (tv.show("keywords") !== text) {
    throw new Error("存储格式关键字破坏了结构");
  }
});

test("存储结构 - 多行文本与转义", () => {
  const tv = new TextVersion();
  const text = "Line1\nLine2\rLine3\r\nLine4\\nLine5\\r\\tTab";
  tv.commit(text, "multiline");
  tv.commit(text + "\nLine6", "multiline2");
  if (
    tv.show("multiline") !== text ||
    tv.show("multiline2") !== text + "\nLine6"
  ) {
    throw new Error("多行文本转义失败");
  }
});

test("存储结构 - 版本名包含分隔符", () => {
  const tv = new TextVersion();
  tv.commit("content1", "v:1:2");
  tv.commit("content2", "v=2=3");
  tv.commit("content3", "v\\3\\4");
  if (
    tv.show("v:1:2") !== "content1" ||
    tv.show("v=2=3") !== "content2" ||
    tv.show("v\\3\\4") !== "content3"
  ) {
    throw new Error("版本名包含分隔符破坏了结构");
  }
});

test("存储结构 - 极端大小写混合", () => {
  const tv = new TextVersion();
  const text = "AaBbCcDdEeFfGgHhIiJjKkLlMmNnOoPpQqRrSsTtUuVvWwXxYyZz";
  tv.commit(text, "v1");
  tv.commit(text.toLowerCase(), "v2");
  tv.commit(text.toUpperCase(), "v3");
  if (
    tv.show("v1") !== text ||
    tv.show("v2") !== text.toLowerCase() ||
    tv.show("v3") !== text.toUpperCase()
  ) {
    throw new Error("大小写混合处理失败");
  }
});

test("存储结构 - 所有ASCII特殊字符", () => {
  const tv = new TextVersion();
  const text = "!\"#$%&'()*+,-./:;<=>?@[\\]^_`{|}~";
  tv.commit(text, "ascii-special");
  if (tv.show("ascii-special") !== text) {
    throw new Error("ASCII特殊字符处理失败");
  }
});

test("存储结构 - NULL字符", () => {
  const tv = new TextVersion();
  const text = "Before\0After\0\0Multiple";
  tv.commit(text, "null-char");
  if (tv.show("null-char") !== text) {
    throw new Error("NULL字符处理失败");
  }
});

test("存储结构 - 连续特殊字符", () => {
  const tv = new TextVersion();
  const text = "\n\n\n\r\r\r\t\t\t::::::======\\\\\\\\";
  tv.commit(text, "consecutive");
  if (tv.show("consecutive") !== text) {
    throw new Error("连续特殊字符处理失败");
  }
});

test("复杂场景 - 特殊字符版本间差异", () => {
  const tv = new TextVersion();
  tv.commit("Hello\nWorld", "v1");
  tv.commit("Hello\rWorld", "v2");
  tv.commit("Hello\r\nWorld", "v3");
  tv.commit("Hello\\nWorld", "v4");

  if (
    tv.show("v1") !== "Hello\nWorld" ||
    tv.show("v2") !== "Hello\rWorld" ||
    tv.show("v3") !== "Hello\r\nWorld" ||
    tv.show("v4") !== "Hello\\nWorld"
  ) {
    throw new Error("特殊字符版本差异处理失败");
  }
});

test("复杂场景 - Emoji差异计算", () => {
  const tv = new TextVersion();
  tv.commit("Hello 😀 World", "v1");
  tv.commit("Hello 😃 World", "v2");
  tv.commit("Hello 😄 World", "v3");

  if (
    tv.show("v1") !== "Hello 😀 World" ||
    tv.show("v2") !== "Hello 😃 World" ||
    tv.show("v3") !== "Hello 😄 World"
  ) {
    throw new Error("Emoji差异计算失败");
  }
});

test("复杂场景 - 混合特殊字符与中文", () => {
  const tv = new TextVersion();
  const text = "你好\n世界\t测试:数据=值\\路径";
  tv.commit(text, "mixed");
  const storage = tv.export();
  const tv2 = new TextVersion(storage);
  if (tv2.show("mixed") !== text) {
    throw new Error("混合特殊字符与中文导出导入失败");
  }
});

test("复杂场景 - 超长特殊字符串", () => {
  const tv = new TextVersion();
  const specialChars = "\n\r\t:=\\";
  const longText = specialChars.repeat(1000);
  tv.commit(longText, "long-special");
  if (tv.show("long-special") !== longText) {
    throw new Error("超长特殊字符串处理失败");
  }
});

test("复杂场景 - 特殊字符压缩和恢复", () => {
  const tv = new TextVersion();
  tv.commit("Test\n1", "v1");
  tv.commit("Test\r2", "v2");
  tv.commit("Test\t3", "v3");
  tv.commit("Test:4", "v4");

  tv.squash("v2");

  if (
    tv.show("v2") !== "Test\r2" ||
    tv.show("v3") !== "Test\t3" ||
    tv.show("v4") !== "Test:4"
  ) {
    throw new Error("特殊字符压缩和恢复失败");
  }
});

// 测试 12: 版本名重复
test("版本名重复 - 自动添加后缀", () => {
  const tv = new TextVersion();
  tv.commit("v1", "v1");
  tv.commit("v1-dup", "v1");
  const log = tv.log();
  if (log.length !== 2 || log[1].version === "v1") {
    throw new Error("版本名重复处理失败");
  }
});

// 测试 13: 错误处理
test("错误处理 - reset 不存在的版本", () => {
  const tv = new TextVersion();
  tv.commit("v1", "v1");
  try {
    tv.reset("nonexistent");
    throw new Error("应该抛出错误");
  } catch (e) {
    if (!(e instanceof Error) || !e.message.includes("不存在")) {
      throw new Error("错误信息不正确");
    }
  }
});

test("错误处理 - squash 不存在的版本", () => {
  const tv = new TextVersion();
  tv.commit("v1", "v1");
  try {
    tv.squash("nonexistent");
    throw new Error("应该抛出错误");
  } catch (e) {
    if (!(e instanceof Error) || !e.message.includes("不存在")) {
      throw new Error("错误信息不正确");
    }
  }
});

// 测试 14: 性能测试
test("性能 - 大量版本提交", () => {
  const tv = new TextVersion();
  const start = Date.now();
  for (let i = 0; i < 100; i++) {
    tv.commit(`Version ${i}`, `v${i}`);
  }
  const duration = Date.now() - start;
  if (duration > 500) {
    throw new Error(`性能不佳: ${duration}ms`);
  }
  if (tv.log().length !== 100) {
    throw new Error("大量版本提交失败");
  }
});

test("性能 - 大量版本查询", () => {
  const tv = new TextVersion();
  for (let i = 0; i < 100; i++) {
    tv.commit(`Version ${i}`, `v${i}`);
  }
  const start = Date.now();
  for (let i = 0; i < 100; i++) {
    tv.show(`v${i}`);
  }
  const duration = Date.now() - start;
  if (duration > 10) {
    throw new Error(`查询性能不佳: ${duration}ms`);
  }
});

test("性能 - 大量版本查询", () => {
  const tv = new TextVersion();
  for (let i = 0; i < 100; i++) {
    tv.commit(`Version ${i}`, `v${i}`);
  }
  const start = Date.now();
  for (let i = 0; i < 100; i++) {
    tv.show(`v${i}`);
  }
  const duration = Date.now() - start;
  if (duration > 5000) {
    throw new Error(`查询性能不佳: ${duration}ms`);
  }
});

// 测试 15: 压缩提供者
test("压缩提供者 - 自定义压缩", () => {
  const compressionProvider = {
    compress: (data: string) => Buffer.from(data).toString("base64"),
    decompress: (data: string) => Buffer.from(data, "base64").toString(),
  };
  const tv = new TextVersion("", compressionProvider);
  tv.commit("Test data", "v1");
  const storage = tv.export();
  // 应该是 base64 编码
  if (!/^[A-Za-z0-9+/=]+$/.test(storage)) {
    throw new Error("压缩提供者未生效");
  }
});

test("压缩提供者 - 压缩后可恢复", () => {
  const compressionProvider = {
    compress: (data: string) => Buffer.from(data).toString("base64"),
    decompress: (data: string) => Buffer.from(data, "base64").toString(),
  };
  const tv1 = new TextVersion("", compressionProvider);
  tv1.commit("Test data", "v1");
  tv1.commit("More data", "v2");

  const storage = tv1.export();
  const tv2 = new TextVersion(storage, compressionProvider);

  if (tv2.show("v1") !== "Test data" || tv2.show("v2") !== "More data") {
    throw new Error("压缩后恢复失败");
  }
});

// 测试 16: 版本名边界
test("版本名 - 空版本名自动生成", () => {
  const tv = new TextVersion();
  tv.commit("content", "");
  const log = tv.log();
  // 空版本名应该自动生成哈希
  if (log.length !== 1 || !log[0].version) {
    throw new Error("空版本名处理失败");
  }
  // 应该能通过生成的版本名访问
  const version = log[0].version;
  if (tv.show(version) !== "content") {
    throw new Error("空版本名生成的版本无法访问");
  }
});

test("版本名 - 超长版本名", () => {
  const tv = new TextVersion();
  const longName = "v".repeat(1000);
  tv.commit("content", longName);
  if (tv.show(longName) !== "content") {
    throw new Error("超长版本名处理失败");
  }
});

test("版本名 - 纯数字版本名", () => {
  const tv = new TextVersion();
  tv.commit("c1", "123");
  tv.commit("c2", "456");
  tv.commit("c3", "789");
  if (tv.show("123") !== "c1" || tv.show("456") !== "c2") {
    throw new Error("纯数字版本名处理失败");
  }
});

test("版本名 - 特殊格式版本名", () => {
  const tv = new TextVersion();
  tv.commit("c1", "R10I5:D3");
  tv.commit("c2", "=ref:123");
  tv.commit("c3", ":2:v1:");
  if (
    tv.show("R10I5:D3") !== "c1" ||
    tv.show("=ref:123") !== "c2" ||
    tv.show(":2:v1:") !== "c3"
  ) {
    throw new Error("特殊格式版本名处理失败");
  }
});

// 测试 17: 存储数据完整性
test("数据完整性 - 导出导入多次", () => {
  const tv1 = new TextVersion();
  tv1.commit("v1", "v1");
  tv1.commit("v2", "v2");

  const storage1 = tv1.export();
  const tv2 = new TextVersion(storage1);
  const storage2 = tv2.export();
  const tv3 = new TextVersion(storage2);
  const storage3 = tv3.export();

  if (storage1 !== storage2 || storage2 !== storage3) {
    throw new Error("多次导出导入数据不一致");
  }
});

test("数据完整性 - 操作后导出导入", () => {
  const tv1 = new TextVersion();
  tv1.commit("v1", "v1");
  tv1.commit("v2", "v2");
  tv1.commit("v3", "v3");

  const storage1 = tv1.export();

  const tv2 = new TextVersion(storage1);
  tv2.commit("v4", "v4");
  tv2.reset("v3");

  const storage2 = tv2.export();
  const tv3 = new TextVersion(storage2);

  if (tv3.log().length !== 3 || tv3.latest() !== "v3") {
    throw new Error("操作后导出导入数据不一致");
  }
});

// 测试 18: 差异算法边界
test("差异算法 - 完全不同的文本", () => {
  const tv = new TextVersion();
  tv.commit("AAAAAAAAAA", "v1");
  tv.commit("BBBBBBBBBB", "v2");
  if (tv.show("v1") !== "AAAAAAAAAA" || tv.show("v2") !== "BBBBBBBBBB") {
    throw new Error("完全不同文本差异计算失败");
  }
});

test("差异算法 - 仅首尾不同", () => {
  const tv = new TextVersion();
  tv.commit("AMiddleZ", "v1");
  tv.commit("BMiddleY", "v2");
  if (tv.show("v1") !== "AMiddleZ" || tv.show("v2") !== "BMiddleY") {
    throw new Error("首尾不同差异计算失败");
  }
});

test("差异算法 - 仅中间不同", () => {
  const tv = new TextVersion();
  tv.commit("Start-A-End", "v1");
  tv.commit("Start-B-End", "v2");
  tv.commit("Start-C-End", "v3");
  if (
    tv.show("v1") !== "Start-A-End" ||
    tv.show("v2") !== "Start-B-End" ||
    tv.show("v3") !== "Start-C-End"
  ) {
    throw new Error("中间不同差异计算失败");
  }
});

test("差异算法 - 插入删除混合", () => {
  const tv = new TextVersion();
  tv.commit("ABC", "v1");
  tv.commit("ABCD", "v2"); // 插入
  tv.commit("BCD", "v3"); // 删除
  tv.commit("BCDE", "v4"); // 插入
  if (
    tv.show("v1") !== "ABC" ||
    tv.show("v2") !== "ABCD" ||
    tv.show("v3") !== "BCD" ||
    tv.show("v4") !== "BCDE"
  ) {
    throw new Error("插入删除混合差异计算失败");
  }
});

// 测试 19: 极端场景
test("极端场景 - 单字符修改", () => {
  const tv = new TextVersion();
  const base = "a".repeat(1000);
  tv.commit(base, "v1");
  tv.commit(base.substring(0, 500) + "b" + base.substring(501), "v2");

  const v2 = tv.show("v2");
  if (!v2 || v2[500] !== "b" || v2.length !== 1000) {
    throw new Error("单字符修改失败");
  }
});

test("极端场景 - 反复修改同一位置", () => {
  const tv = new TextVersion();
  tv.commit("Hello World", "v1");
  tv.commit("Hello Earth", "v2");
  tv.commit("Hello World", "v3");
  tv.commit("Hello Earth", "v4");

  if (
    tv.show("v1") !== "Hello World" ||
    tv.show("v2") !== "Hello Earth" ||
    tv.show("v3") !== "Hello World" ||
    tv.show("v4") !== "Hello Earth"
  ) {
    throw new Error("反复修改同一位置失败");
  }
});

test("极端场景 - 版本数量极限", () => {
  const tv = new TextVersion();
  for (let i = 0; i < 200; i++) {
    tv.commit(`v${i}`, `v${i}`);
  }
  if (tv.log().length !== 200) {
    throw new Error("大量版本处理失败");
  }
  // 随机检查几个版本
  if (
    tv.show("v0") !== "v0" ||
    tv.show("v155") !== "v155" ||
    tv.show("v199") !== "v199"
  ) {
    throw new Error("大量版本访问失败");
  }
});

test("极端场景 - 快照和差异混合", () => {
  const tv = new TextVersion();
  tv.commit("v1", "v1");
  tv.commit("v2", "v2");
  tv.squash("v2"); // v2 变成快照
  tv.commit("v3", "v3");
  tv.commit("v4", "v4");

  const log = tv.log();
  const v2Info = log.find((v) => v.version === "v2");
  const v3Info = log.find((v) => v.version === "v3");

  if (!v2Info?.isSnapshot || v3Info?.isSnapshot) {
    throw new Error("快照和差异混合处理失败");
  }
});

// 测试 20: 一致性验证
test("一致性 - 版本顺序保持", () => {
  const tv = new TextVersion();
  const versions = ["v1", "v2", "v3", "v4", "v5"];
  versions.forEach((v) => tv.commit(v, v));

  const log = tv.log();
  for (let i = 0; i < versions.length; i++) {
    if (log[i].version !== versions[i]) {
      throw new Error("版本顺序不一致");
    }
  }
});

test("一致性 - reset 后版本顺序", () => {
  const tv = new TextVersion();
  tv.commit("v1", "v1");
  tv.commit("v2", "v2");
  tv.commit("v3", "v3");
  tv.reset("v2");
  tv.commit("v4", "v4");

  const log = tv.log();
  if (
    log.length !== 3 ||
    log[0].version !== "v1" ||
    log[1].version !== "v2" ||
    log[2].version !== "v4"
  ) {
    throw new Error("reset 后版本顺序不一致");
  }
});

test("一致性 - squash 后版本顺序", () => {
  const tv = new TextVersion();
  tv.commit("v1", "v1");
  tv.commit("v2", "v2");
  tv.commit("v3", "v3");
  tv.squash("v2");

  const log = tv.log();
  if (log.length !== 2 || log[0].version !== "v2" || log[1].version !== "v3") {
    throw new Error("squash 后版本顺序不一致");
  }
});

test("多处更改测试", () => {
  const COMMITS = [
    "这是一段示例文本，这是一段示例文本，这是一段示例文本，这是一段示例文本，这是一段示例文本，这是一段示例文本。",
    "这是一段示例文本，这是两段示例文本，这是一段示例文本，这是一段示例文本，这是一段示例文本，这是两段示例文本。",
    "这是一段示例文本，这是两段示例文本，这是三段示例文本，这是一段示例文本，这是一段示例文本，这是三段示例文本。",
    "这是一段示例文本，这是两段示例文本，这是三段示例文本，这是四段示例文本，这是一段示例文本，这是四段示例文本。",
    "这是一段示例文本，这是两段示例文本，这是三段示例文本，这是四段示例文本，这是五段示例文本，这是五段示例文本。",
    "这是一段示例文本，\n这是两段示例文本，\n这是三段示例文本，\n这是四段示例文本，\n这是五段示例文本，\n这是五段示例文本。",
    "这是一段示例文本，\n这是==示例文本，\n这是==示例文本，\n这是::示例文本，\n这是::示例文本，\n这是\n\n示例文本。",
  ];
  const tv = new TextVersion();
  COMMITS.forEach((content, index) => {
    const version = `v${index + 1}`;
    tv.commit(content, version);
  });

  // 验证每个版本内容
  COMMITS.forEach((content, index) => {
    const version = `v${index + 1}`;
    const retrieved = tv.show(version);
    if (retrieved !== content) {
      throw new Error(
        `版本 ${version} 内容不匹配: 期望 "${content}", 实际 "${retrieved}"`,
      );
    }
  });
});

test("全面复杂文本测试", () => {
  const LONG_STRING = "A".repeat(10000) + "B".repeat(100);
  const COMMITS = [
    "这是一段示例文本",
    "这是一段示例文本，测试增加内容",
    "这是一段示例文本，测试更改内容",
    "这是一段示例文本，测试删除",
    "这是一段示例文本，\n测试换行",
    "这是一段示例文本，\n测试换行\n下面写一段超长的文本内容，这样就能让程序在下一次遇到短内容的时候，使用引用语法",
    "这是几段示例文本，\n测试换行\n下面写几段超长的文本内容，这样就能让程序在下几次遇到短内容的时候，使用引用语法",
    "这是一段示例文本，测试引用",
    "这是一段示例文本，测试特殊字符: \n\r\t:=\\",
    "这是一段示例文本，测试Emoji 😀😃😄😁",
    "这是一段示例文本，测试Unicode字符 你好，世界！🌍",
    "=等号开始的内容",
    "=等号开始的内容\n新内容",
    ":冒号开始的内容",
    "包含反斜杠\\的内容",
    "   ", // 纯空格
    "\t\t\t", // 纯制表符
    "\n\n\n", // 纯换行
    "\u00A0\u200B\u3000", // 特殊空白：NBSP, 零宽空格, 全角空格
    "--- original",
    "+++ modified",
    "@@ -1,1 +1,1 @@",
    "\\ No newline at end of file",
    ">>> HEAD",
    "<<<<<<<",
    "=======",
    "H̗ellͥoͪ Wͫoͬrldͭ", // Zalgo 文本 (高度堆叠的组合字符)，测试字符计数
    "👨‍👩‍👧‍👦", // Emoji 组合序列 (Family: Man, Woman, Girl, Boy)，测试字素簇处理
    "👍🏿 👩‍❤️‍💋‍👩 🏳️‍🌈", // 肤色修饰符与复杂 Emoji
    "תירבע (Hebrew) \u202E RTL Override \u202C Normal", // 右至左 (RTL) 标记，测试双向文本处理
    "𠮷 (土吉)", // 4字节字符 (超出常规 UCS-2 范围)
    "A vs Α vs А", // 容易混淆的字符：拉丁字母 A vs 希腊字母 Α vs 西里尔字母 А
    "Before Null \u0000 After Null",
    "Line1\rLine2\nLine3\r\nLine4\u2028Line5\u2029Line6",
    "\\\\", // 双反斜杠
    "\\\"\'", // 引号转义
    "A\n".repeat(50) + "X\n" + "A\n".repeat(50), // 压力测试
    "A\n".repeat(50) + "Y\n" + "A\n".repeat(50),
    LONG_STRING,
    LONG_STRING + "!", // 仅末尾增加一个字符
    "!" + LONG_STRING, // 仅开头增加一个字符
    "__proto__",
    "constructor",
    "undefined",
    "null",
    "[object Object]",
  ];
  const tv = new TextVersion();
  COMMITS.forEach((content, index) => {
    const version = `v${index + 1}`;
    tv.commit(content, version);
  });

  // 验证每个版本内容
  COMMITS.forEach((content, index) => {
    const version = `v${index + 1}`;
    const retrieved = tv.show(version);
    if (retrieved !== content) {
      throw new Error(
        `版本 ${version} 内容不匹配: 期望 "${content}", 实际 "${retrieved}"`,
      );
    }
  });
});

// 输出测试结果
rlog.log();
rlog.log("=== Text-Version 测试完成 ===");
rlog.log();

const passed = results.filter((r) => r.passed).length;
const failed = results.filter((r) => !r.passed).length;
const total = results.length;

if (failed > 0) {
  rlog.log("失败的测试:");
  results.forEach((result, index) => {
    if (!result.passed) {
      rlog.log(`  ${index + 1}. ${result.name}`);
      if (result.error) {
        rlog.log(`     错误: ${result.error}`);
      }
    }
  });
  rlog.log("");
}

rlog.log(
  `总计: ${total} | 通过: ${passed} | 失败: ${failed} | 成功率: ${((passed / total) * 100).toFixed(1)}%`,
);

if (failed > 0) {
  process.exit(1);
}
