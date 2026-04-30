'use client';

import {
  Children,
  isValidElement,
  type ReactElement,
  type ReactNode,
  useState,
} from 'react';

interface TabProps {
  label: string;
  children: ReactNode;
}

export function Tab(_props: TabProps): null {
  return null;
}

export function Tabs({ children }: { children: ReactNode }) {
  const tabs = Children.toArray(children).filter(
    (c): c is ReactElement<TabProps> =>
      isValidElement(c) && (c.type as { displayName?: string })?.displayName === 'Tab',
  );
  const [active, setActive] = useState(0);
  if (tabs.length === 0) return null;

  return (
    <div className="tabs">
      <div className="tbar">
        {tabs.map((t, i) => (
          <button
            key={t.props.label}
            className={`tb${i === active ? ' on' : ''}`}
            onClick={() => setActive(i)}
          >
            {t.props.label}
          </button>
        ))}
      </div>
      {tabs.map((t, i) => (
        <div key={t.props.label} className={`tp${i === active ? ' on' : ''}`}>
          {t.props.children}
        </div>
      ))}
    </div>
  );
}

Tab.displayName = 'Tab';
