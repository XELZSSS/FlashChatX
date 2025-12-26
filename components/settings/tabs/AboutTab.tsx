// Hooks
import React from 'react';
// Components
import PlatformLinks from '../../PlatformLinks';

type AboutTabProps = {
  t: (key: string) => string;
};

const AboutTab: React.FC<AboutTabProps> = ({ t }) => {
  return (
    <div className="space-y-6 max-w-xl">
      <div className="space-y-4">
        <h3 className="text-xl font-semibold text-muted">{t('about')}</h3>
        <PlatformLinks />
      </div>
    </div>
  );
};

export default AboutTab;
