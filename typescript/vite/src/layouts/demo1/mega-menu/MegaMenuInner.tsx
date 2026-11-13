import { useEffect, useState } from 'react';
import { TMenuConfig, MenuItem, MenuLink, MenuTitle, Menu } from '@/components/menu';
import { useDemo1Layout } from '../Demo1LayoutProvider';
import { MENU_MEGA } from '@/config';

/** Top header bar: a flat row of quick links to the main IVR screens. */
const MegaMenuInner = () => {
  const [disabled, setDisabled] = useState(true); // Initially set disabled to true
  const { layout, sidebarMouseLeave, setMegaMenuEnabled } = useDemo1Layout();

  // Re-enable the menu shortly after the sidebar changes, so a sidebar hover
  // does not accidentally open header items.
  useEffect(() => {
    setDisabled(true);

    const timer = setTimeout(() => {
      setDisabled(false);
    }, 1000);

    return () => clearTimeout(timer);
  }, [layout.options.sidebar.collapse, sidebarMouseLeave]);

  useEffect(() => {
    setMegaMenuEnabled(true);
  });

  const linkClass =
    'menu-link text-sm text-gray-700 font-medium menu-link-hover:text-primary menu-item-active:text-gray-900 menu-item-show:text-primary menu-item-here:text-gray-900';

  const build = (items: TMenuConfig) =>
    items.map((item) => (
      <MenuItem key={item.path ?? item.title}>
        <MenuLink path={item.path} className={linkClass}>
          <MenuTitle className="text-nowrap">{item.title}</MenuTitle>
        </MenuLink>
      </MenuItem>
    ));

  return (
    <Menu
      multipleExpand={true}
      disabled={disabled}
      highlight={true}
      className="flex-col lg:flex-row gap-5 lg:gap-7.5 p-5 lg:p-0"
    >
      {build(MENU_MEGA)}
    </Menu>
  );
};

export { MegaMenuInner };
