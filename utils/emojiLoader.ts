let cachedEmojiData: unknown | null = null;
let emojiDataPromise: Promise<unknown> | null = null;

export const getCachedEmojiData = () => cachedEmojiData;

export const loadEmojiData = async () => {
  if (cachedEmojiData) return cachedEmojiData;
  if (!emojiDataPromise) {
    emojiDataPromise = import('@emoji-mart/data/sets/15/native.json').then(
      module => module.default ?? module
    );
  }
  cachedEmojiData = await emojiDataPromise;
  return cachedEmojiData;
};

export const preloadEmojiData = () => {
  void loadEmojiData();
};
