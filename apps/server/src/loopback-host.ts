const LOOPBACK_HOSTNAMES = new Set(["localhost", "127.0.0.1", "[::1]"]);

/**
 * 요청의 Host가 이 컴퓨터(loopback)를 가리키는지
 * 외부 웹페이지가 DNS rebinding으로 로컬 API를 부르는 것을 막음
 */
export function isLoopbackHost(hostHeader: string | undefined): boolean {
  if (!hostHeader) return false;
  const hostname = hostHeader.startsWith("[")
    ? hostHeader.slice(0, hostHeader.indexOf("]") + 1)
    : (hostHeader.split(":")[0] ?? "");
  return LOOPBACK_HOSTNAMES.has(hostname.toLowerCase());
}
