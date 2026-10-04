// Keep the public hook entry stable across dev-server hot updates. The portal
// implementation uses JSX, but existing module requests still target this file.
export { copyPictureInPictureStyles, useDocumentPictureInPicture } from './useDocumentPictureInPictureWidget';
