/**
 * Scene stack: manages the current Phaser.Scene reference
 * for synchronous createElement resolution.
 *
 * Solid renders components top-down synchronously, so by the time
 * a child's createElement is called, the parent Scene's pushScene
 * has already executed.
 */

let _currentScene: Phaser.Scene | null = null;
const sceneStack: Phaser.Scene[] = [];

export function pushScene(scene: Phaser.Scene): void {
  sceneStack.push(scene);
  _currentScene = scene;
}

export function popScene(): void {
  sceneStack.pop();
  _currentScene = sceneStack[sceneStack.length - 1] ?? null;
}

export function getCurrentScene(): Phaser.Scene | null {
  return _currentScene;
}

/**
 * Reset the scene stack (for testing).
 */
export function resetSceneStack(): void {
  sceneStack.length = 0;
  _currentScene = null;
}
