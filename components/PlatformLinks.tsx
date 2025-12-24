import React from 'react';
import { useTranslation } from '../contexts/useTranslation';

const PlatformLinks: React.FC = () => {
  const { t } = useTranslation();

  const platforms = [
    { name: t('deepseekPlatform'), url: 'https://platform.deepseek.com' },
    {
      name: t('openaiPlatform'),
      url: 'https://platform.openai.com/docs/overview',
    },
    {
      name: t('mimoPlatform'),
      url: 'https://platform.xiaomimimo.com/#/docs/welcome',
    },
    {
      name: t('zPlatform'),
      url: 'https://bigmodel.cn/login?redirect=%2Fconsole%2Foverview',
    },
    { name: t('zIntlPlatform'), url: 'https://z.ai/subscribe' },
    { name: t('bailingPlatform'), url: 'https://ling.tbox.cn/open' },
    { name: t('longcatPlatform'), url: 'https://longcat.chat/platform' },
    { name: t('modelscopePlatform'), url: 'https://www.modelscope.cn/models' },
    {
      name: t('moonshotPlatform'),
      url: 'https://platform.moonshot.cn/docs/overview',
    },
    { name: t('minimaxPlatform'), url: 'https://platform.minimaxi.com/' },
    {
      name: t('googlePlatform'),
      url: 'https://ai.google.dev/gemini-api/docs?hl=zh-cn',
    },
    {
      name: t('anthropicPlatform'),
      url: 'https://www.anthropic.com/learn/build-with-claude',
    },
  ];

  // Sort platforms by button text length from shortest to longest
  const sortedPlatforms = [...platforms].sort(
    (a, b) => a.name.length - b.name.length
  );

  return (
    <div className="flex flex-wrap gap-3">
      {sortedPlatforms.map(platform => (
        <a
          key={platform.name}
          href={platform.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--accent-soft)] text-accent rounded-lg hover:bg-[var(--accent)] hover:text-white transition-colors text-sm font-medium"
        >
          {platform.name}
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
            />
          </svg>
        </a>
      ))}
    </div>
  );
};

export default PlatformLinks;
