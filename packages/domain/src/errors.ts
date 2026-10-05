export class DomainError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, message: string, status = 400) {
    super(message);
    this.name = "DomainError";
    this.code = code;
    this.status = status;
  }
}

/** 같은 프로젝트 폴더를 다른 기안서가 결재 전 변경으로 쓰고 있음 */
export class ProjectBusyError extends DomainError {
  readonly holderTitle: string;

  constructor(holderTitle: string) {
    super("PROJECT_BUSY", `같은 프로젝트에서 '${holderTitle}' 작업이 끝나면 시작할 수 있어요`, 409);
    this.holderTitle = holderTitle;
  }
}
