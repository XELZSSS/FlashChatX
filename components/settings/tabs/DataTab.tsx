// Hooks
import React from 'react';
// Icons
import { Calculator } from 'lucide-react';

type ConversionResult = {
  english: number;
  chinese: number;
};

type DataTabProps = {
  t: (key: string) => string;
  calculationMode: 'tokenToChar' | 'charToToken';
  setCalculationMode: (mode: 'tokenToChar' | 'charToToken') => void;
  tokenInput: string;
  setTokenInput: (value: string) => void;
  charInput: string;
  setCharInput: (value: string) => void;
  tokenToChar: ConversionResult;
  charToToken: ConversionResult;
  sanitizeNumber: (value: string) => string;
};

const DataTab: React.FC<DataTabProps> = ({
  t,
  calculationMode,
  setCalculationMode,
  tokenInput,
  setTokenInput,
  charInput,
  setCharInput,
  tokenToChar,
  charToToken,
  sanitizeNumber,
}) => {
  return (
    <div className="space-y-8 max-w-xl">
      {/* Token Calculator Section */}
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4 pr-12">
          <div className="flex items-center gap-2">
            <Calculator className="w-5 h-5 text-muted" />
            <h3 className="text-xl font-semibold text-muted">
              {t('tokenCalculator')}
            </h3>
          </div>
          <div className="flex items-center rounded-full bg-[var(--panel-strong)] p-1">
            <button
              onClick={() => setCalculationMode('tokenToChar')}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                calculationMode === 'tokenToChar'
                  ? 'bg-[var(--accent)] text-white'
                  : 'text-subtle hover:text-[var(--text)]'
              }`}
            >
              {t('tokenToChar')}
            </button>
            <button
              onClick={() => setCalculationMode('charToToken')}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                calculationMode === 'charToToken'
                  ? 'bg-[var(--accent)] text-white'
                  : 'text-subtle hover:text-[var(--text)]'
              }`}
            >
              {t('charToToken')}
            </button>
          </div>
        </div>

        {/* Input Section */}
        <div className="space-y-4">
          {calculationMode === 'tokenToChar' ? (
            <div className="space-y-2">
              <label className="block text-base text-subtle">
                {t('tokenCount')}
              </label>
              <input
                type="text"
                className="provider-field w-full rounded-xl border px-4 py-2.5 text-base focus:outline-none"
                placeholder={t('enterTokenCount')}
                value={tokenInput}
                onChange={e => setTokenInput(sanitizeNumber(e.target.value))}
              />
            </div>
          ) : (
            <div className="space-y-2">
              <label className="block text-base text-subtle">
                {t('characterCount')}
              </label>
              <input
                type="text"
                className="provider-field w-full rounded-xl border px-4 py-2.5 text-base focus:outline-none"
                placeholder={t('enterCharacterCount')}
                value={charInput}
                onChange={e => setCharInput(sanitizeNumber(e.target.value))}
              />
            </div>
          )}

          {(tokenInput || charInput) && (
            <div className="text-base text-muted">
              <div className="font-medium mb-2">{t('conversionResult')}</div>
              {calculationMode === 'tokenToChar' ? (
                <div className="space-y-1">
                  <div>
                    {t('englishCharacters')}: {tokenToChar.english}
                  </div>
                  <div>
                    {t('chineseCharacters')}: {tokenToChar.chinese}
                  </div>
                </div>
              ) : (
                <div className="space-y-1">
                  <div>
                    {t('englishTokens')}: {charToToken.english}
                  </div>
                  <div>
                    {t('chineseTokens')}: {charToToken.chinese}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Conversion Reference */}
        <div className="p-4 surface-ghost rounded-lg">
          <div className="text-base text-subtle">
            <div className="font-medium mb-2">{t('conversionReference')}</div>
            <div className="space-y-1 text-sm">
              <div>{t('tokenConversionRef1')}</div>
              <div>{t('tokenConversionRef2')}</div>
              <div>{t('tokenConversionRef3')}</div>
              <div>{t('tokenConversionRef4')}</div>
              <div>{t('tokenConversionRef5')}</div>
            </div>
          </div>
        </div>
        <div className="mt-3 text-base text-subtle">
          {t('tokenCalculatorNote')}
        </div>
      </div>
    </div>
  );
};

export default DataTab;
