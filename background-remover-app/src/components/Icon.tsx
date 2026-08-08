interface IconProps {
  name: string;
  size?: number;
}

const paths: Record<string, string> = {
  back: 'M15 18l-6-6 6-6M9 12h10',
  upload: 'M12 16V4m0 0L7 9m5-5 5 5M5 20h14',
  download: 'M12 4v12m0 0 5-5m-5 5-5-5M5 20h14',
  auto: 'M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3zm6 12l.8 2.2L21 18l-2.2.8L18 21l-.8-2.2L15 18l2.2-.8L18 15z',
  erase: 'M3 17l7.5-10.5a2 2 0 012.8-.4l4.6 3.3a2 2 0 01.4 2.8L12 21H7l-4-4zm6.5 4L5 16.5',
  restore: 'M4 12a8 8 0 101.8-5.1L4 9m0 0V4m0 5h5',
  refine: 'M4 7h10M4 17h16M14 7l3-3m-3 3l3 3M10 17l-3-3m3 3l-3 3',
  background: 'M4 5h16v14H4zM4 15l4-4 4 4 3-3 5 5M15 9h.01',
  crop: 'M7 3v14a2 2 0 002 2h12M3 7h14a2 2 0 012 2v12',
  adjust: 'M4 7h10M18 7h2M4 17h2M10 17h10M14 4v6M7 14v6',
  effects: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3z',
  design: 'M4 20l4-1 10-10-3-3L5 16l-1 4zM13 8l3 3',
  layers: 'M12 3l9 5-9 5-9-5 9-5zm-9 10l9 5 9-5M3 17l9 5 9-5',
  undo: 'M9 7l-5 5 5 5M4 12h10a6 6 0 016 6',
  redo: 'M15 7l5 5-5 5m5-5H10a6 6 0 00-6 6',
  close: 'M6 6l12 12M18 6L6 18',
  check: 'M5 12l4 4L19 6',
  shield: 'M12 3l8 3v5c0 5-3.4 8.7-8 10-4.6-1.3-8-5-8-10V6l8-3zM9 12l2 2 4-5',
  image: 'M4 5h16v14H4zM7 15l3-3 3 3 2-2 3 3M15 9h.01',
  plus: 'M12 5v14M5 12h14',
  trash: 'M5 7h14M10 11v6m4-6v6M8 7l1-3h6l1 3m1 0l-1 14H8L7 7',
  eye: 'M2 12s4-6 10-6 10 6 10 6-4 6-10 6S2 12 2 12zm10 3a3 3 0 100-6 3 3 0 000 6z',
  lock: 'M6 10h12v10H6zM8 10V7a4 4 0 018 0v3',
  menu: 'M4 7h16M4 12h16M4 17h16'
};

export function Icon({ name, size = 20 }: IconProps) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d={paths[name] || paths.image} />
    </svg>
  );
}
