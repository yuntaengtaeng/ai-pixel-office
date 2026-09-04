const [major, minor] = process.versions.node.split(".").map(Number);
const supported = major > 22 || (major === 22 && minor >= 18);

if (!supported) {
  console.error(
    `현재 Node.js ${process.version}은 지원하지 않습니다. Node.js 22.18 이상(24 LTS 권장)으로 업데이트해 주세요.`,
  );
  process.exit(1);
}
