import { planNextTap } from './planner';

self.onmessage = (event: MessageEvent<{
  board: number[];
  affected: number[][];
}>) => {
  const { board, affected } = event.data;
  self.postMessage(planNextTap(board, affected));
};
