export const zIndex = {
  content: 1,
  raised: 2,
  floating: 3,
  navigation: 10,
  popover: 50,
  notification: 100,
  dialogBackdrop: 120,
  dialog: 121,
} as const;

export type ZIndex = typeof zIndex;
