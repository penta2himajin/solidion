export function VisTest() {
  return <rectangle x={100} y={100} width={50} height={50} fillColor={0xff0000} visible={false} onClick={() => {}} />;
}
// Force inclusion
(window as any).__VisTest = VisTest;
