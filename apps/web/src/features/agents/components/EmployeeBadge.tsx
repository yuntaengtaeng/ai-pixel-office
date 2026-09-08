import styled from "styled-components";
import { PetPreview } from "../../office/PetPreview.tsx";

const Badge = styled.article`
  position: relative;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  gap: ${({ theme }) => theme.space.x4};
  padding: ${({ theme }) => theme.space.x5};
  border: 2px solid ${({ theme }) => theme.colors.border.strong};
  background: ${({ theme }) => theme.colors.background.surfaceMuted};
  box-shadow: 4px 4px 0 ${({ theme }) => theme.colors.shadow.default};
  &::before {
    content: "";
    position: absolute;
    inset: 0 0 auto;
    height: 6px;
    background: ${({ theme }) => theme.colors.brand.primary};
  }
  &::after {
    content: "";
    position: absolute;
    width: 44px;
    height: 8px;
    top: 12px;
    left: 50%;
    transform: translateX(-50%);
    border: 2px solid ${({ theme }) => theme.colors.border.strong};
    background: ${({ theme }) => theme.colors.background.canvas};
  }
`;
const PassHeader = styled.div`
  grid-column: 1 / -1;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: ${({ theme }) => theme.space.x3};
  padding-bottom: ${({ theme }) => theme.space.x2};
  border-bottom: 1px solid ${({ theme }) => theme.colors.border.subtle};
  strong,
  span {
    font-family: ${({ theme }) => theme.typography.fontFamily.mono};
    font-size: ${({ theme }) => theme.typography.fontSize.micro};
    letter-spacing: 0.08em;
  }
  span {
    color: ${({ theme }) => theme.colors.text.muted};
  }
`;
const Photo = styled.div`
  display: grid;
  place-items: center;
  padding: ${({ theme }) => theme.space.x2};
  border: 2px solid ${({ theme }) => theme.colors.border.default};
  background: ${({ theme }) => theme.colors.background.surfaceRaised};
`;
const Identity = styled.div`
  min-width: 0;
  display: grid;
  gap: ${({ theme }) => theme.space.x1};
  > span,
  > small {
    color: ${({ theme }) => theme.colors.text.muted};
  }
  > span {
    font-family: ${({ theme }) => theme.typography.fontFamily.mono};
    font-size: ${({ theme }) => theme.typography.fontSize.micro};
    font-weight: ${({ theme }) => theme.typography.fontWeight.black};
    letter-spacing: 0.08em;
  }
  > strong {
    font-size: ${({ theme }) => theme.typography.fontSize.headingLg};
  }
  > p {
    margin: 0;
    line-height: 1.5;
  }
`;

export function EmployeeBadge({
  petId,
  name,
  role,
  status = "출근 준비 중",
  meta,
}: {
  petId: string;
  name: string;
  role: string;
  status?: string;
  meta?: string;
}) {
  return (
    <Badge>
      <PassHeader>
        <strong>AI PIXEL OFFICE</strong>
        <span>EMPLOYEE PASS</span>
      </PassHeader>
      <Photo>
        <PetPreview petId={petId} size={72} />
      </Photo>
      <Identity>
        <span>{status}</span>
        <strong>{name || "이름을 입력해 주세요"}</strong>
        <p>{role || "맡을 일을 입력해 주세요"}</p>
        {meta && <small>{meta}</small>}
      </Identity>
    </Badge>
  );
}
