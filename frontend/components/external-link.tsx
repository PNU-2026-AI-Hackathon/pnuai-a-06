import { Href, Link } from 'expo-router';
import { openBrowserAsync, WebBrowserPresentationStyle } from 'expo-web-browser';
import { type ComponentProps } from 'react';

import { usePressGuard } from '@/lib/press-guard';

type Props = Omit<ComponentProps<typeof Link>, 'href'> & { href: Href & string };
type LinkPressEvent = Parameters<NonNullable<ComponentProps<typeof Link>['onPress']>>[0];

export function ExternalLink({ href, ...rest }: Props) {
  const allowPress = usePressGuard();

  return (
    <Link
      target="_blank"
      {...rest}
      href={href}
      onPress={async (event: LinkPressEvent) => {
        if (!allowPress()) {
          event.preventDefault();
          return;
        }

        if (process.env.EXPO_OS !== 'web') {
          // Prevent the default behavior of linking to the default browser on native.
          event.preventDefault();
          // Open the link in an in-app browser.
          await openBrowserAsync(href, {
            presentationStyle: WebBrowserPresentationStyle.AUTOMATIC,
          });
        }
      }}
    />
  );
}
