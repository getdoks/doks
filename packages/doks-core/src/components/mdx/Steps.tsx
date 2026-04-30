import {
  Children,
  isValidElement,
  type ReactElement,
  type ReactNode,
} from 'react';

interface StepProps {
  title?: string;
  children: ReactNode;
}

export function Step(_props: StepProps): null {
  return null;
}

Step.displayName = 'Step';

export function Steps({ children }: { children: ReactNode }) {
  const steps = Children.toArray(children).filter(
    (c): c is ReactElement<StepProps> =>
      isValidElement(c) && (c.type as { displayName?: string })?.displayName === 'Step',
  );
  return (
    <ol className="steps">
      {steps.map((s, i) => (
        <li key={i}>
          <span className="sn">{i + 1}</span>
          <div className="sb-">
            {s.props.title && <strong>{s.props.title}</strong>}
            {s.props.children}
          </div>
        </li>
      ))}
    </ol>
  );
}
