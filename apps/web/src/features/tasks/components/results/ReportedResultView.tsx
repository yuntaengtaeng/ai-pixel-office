import styled from "styled-components";
import { resultSections } from "../../utils/requestResult.ts";

const Styled = {
  Sections: styled.div<{ $compact: boolean }>`
    display: grid;
    gap: ${({ theme }) => theme.space.x4};
    font-size: ${({ $compact, theme }) =>
      $compact ? theme.typography.fontSize.md : theme.typography.fontSize.lg};
    line-height: 1.7;
    h4 {
      margin: 0 0 ${({ theme }) => theme.space.x1};
      color: ${({ theme }) => theme.colors.text.primary};
      font-size: inherit;
    }
    p {
      margin: 0;
      color: ${({ theme }) => theme.colors.text.secondary};
      white-space: pre-wrap;
    }
    ul {
      margin: 0;
      padding-left: ${({ theme }) => theme.space.x5};
      color: ${({ theme }) => theme.colors.text.secondary};
    }
  `,
};

/** 동료가 결과 형식대로 낸 결과 (항목마다 제목과 문단·목록) */
export function ReportedResultView({
  reported,
  compact = false,
}: {
  reported: Record<string, unknown>;
  compact?: boolean;
}) {
  return (
    <Styled.Sections $compact={compact}>
      {resultSections(reported).map((section) => (
        <section key={section.key}>
          <h4>{section.label}</h4>
          {section.paragraphs.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
          {section.items.length > 0 && (
            <ul>
              {section.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </Styled.Sections>
  );
}
