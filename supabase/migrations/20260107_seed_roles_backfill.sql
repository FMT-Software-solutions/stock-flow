DO $$
DECLARE
  org RECORD;
  perm_owner TEXT := '{"dashboard":{"enabled":true,"actions":[]},"user_management":{"enabled":true,"actions":["create","edit","activate_deactivate","delete","update_permissions"]},"branch_management":{"enabled":true,"actions":["create","edit","activate_deactivate"]},"settings":{"enabled":true,"actions":["manage_org_details","view_org_appearance_prefs","manage_org_appearance_prefs","manage_notifications"]},"inventory":{"enabled":true,"actions":["create","edit","delete","export"]},"products":{"enabled":true,"actions":["create","edit","delete","export"]},"product_categories":{"enabled":true,"actions":["create","edit","delete","export"]},"variations":{"enabled":true,"actions":["create","edit","delete"]},"orders":{"enabled":true,"actions":["create","edit","delete","export"]},"customers":{"enabled":true,"actions":["create","edit","delete","export"]},"suppliers":{"enabled":true,"actions":["create","edit","delete","export"]},"reports":{"enabled":true,"actions":["view","export"]},"expenses":{"enabled":true,"actions":["create","edit","delete","export"]}}';
  perm_admin TEXT := '{"dashboard":{"enabled":true,"actions":[]},"user_management":{"enabled":true,"actions":["create","edit","activate_deactivate","delete","update_permissions"]},"branch_management":{"enabled":true,"actions":["create","edit","activate_deactivate"]},"settings":{"enabled":true,"actions":["manage_org_details","view_org_appearance_prefs","manage_org_appearance_prefs","manage_notifications"]},"inventory":{"enabled":true,"actions":["create","edit","delete","export"]},"products":{"enabled":true,"actions":["create","edit","delete","export"]},"product_categories":{"enabled":true,"actions":["create","edit","delete","export"]},"variations":{"enabled":true,"actions":["create","edit","delete"]},"orders":{"enabled":true,"actions":["create","edit","delete","export"]},"customers":{"enabled":true,"actions":["create","edit","delete","export"]},"suppliers":{"enabled":true,"actions":["create","edit","delete","export"]},"reports":{"enabled":true,"actions":["view","export"]},"expenses":{"enabled":true,"actions":["create","edit","delete","export"]}}';
  perm_branch_admin TEXT := '{"dashboard":{"enabled":true,"actions":[]},"user_management":{"enabled":true,"actions":["create","edit","activate_deactivate"]},"branch_management":{"enabled":true,"actions":["edit"]},"settings":{"enabled":true,"actions":["view_org_appearance_prefs"]},"inventory":{"enabled":true,"actions":["create","edit","delete","export"]},"products":{"enabled":true,"actions":["create","edit","delete","export"]},"product_categories":{"enabled":true,"actions":["create","edit","delete","export"]},"variations":{"enabled":true,"actions":["create","edit","delete"]},"orders":{"enabled":true,"actions":["create","edit","delete","export"]},"customers":{"enabled":true,"actions":["create","edit","delete","export"]},"suppliers":{"enabled":true,"actions":["create","edit","delete","export"]},"reports":{"enabled":true,"actions":["view","export"]},"expenses":{"enabled":true,"actions":["create","edit","delete","export"]}}';
  perm_editor TEXT := '{"dashboard":{"enabled":true,"actions":[]}}';
  perm_viewer TEXT := '{"dashboard":{"enabled":true,"actions":[]}}';
BEGIN
  FOR org IN SELECT id FROM public.organizations WHERE is_active = TRUE LOOP
    INSERT INTO public.organization_roles (organization_id, name, type, permissions)
    SELECT org.id, 'Owner', 'owner', perm_owner
    WHERE NOT EXISTS (SELECT 1 FROM public.organization_roles WHERE organization_id = org.id AND type = 'owner');

    INSERT INTO public.organization_roles (organization_id, name, type, permissions)
    SELECT org.id, 'Admin', 'admin', perm_admin
    WHERE NOT EXISTS (SELECT 1 FROM public.organization_roles WHERE organization_id = org.id AND type = 'admin');

    INSERT INTO public.organization_roles (organization_id, name, type, permissions)
    SELECT org.id, 'Branch Admin', 'branch_admin', perm_branch_admin
    WHERE NOT EXISTS (SELECT 1 FROM public.organization_roles WHERE organization_id = org.id AND type = 'branch_admin');

    INSERT INTO public.organization_roles (organization_id, name, type, permissions)
    SELECT org.id, 'Editor', 'custom', perm_editor
    WHERE NOT EXISTS (SELECT 1 FROM public.organization_roles WHERE organization_id = org.id AND name = 'Editor');

    INSERT INTO public.organization_roles (organization_id, name, type, permissions)
    SELECT org.id, 'Viewer', 'custom', perm_viewer
    WHERE NOT EXISTS (SELECT 1 FROM public.organization_roles WHERE organization_id = org.id AND name = 'Viewer');
  END LOOP;

  UPDATE public.user_organizations uo
  SET role_id = orl.id
  FROM public.organization_roles orl
  WHERE uo.role_id IS NULL AND uo.role = 'owner' AND orl.organization_id = uo.organization_id AND orl.type = 'owner';

  UPDATE public.user_organizations uo
  SET role_id = orl.id
  FROM public.organization_roles orl
  WHERE uo.role_id IS NULL AND uo.role = 'admin' AND orl.organization_id = uo.organization_id AND orl.type = 'admin';

  UPDATE public.user_organizations uo
  SET role_id = orl.id
  FROM public.organization_roles orl
  WHERE uo.role_id IS NULL AND uo.role = 'branch_admin' AND orl.organization_id = uo.organization_id AND orl.type = 'branch_admin';

  UPDATE public.user_organizations uo
  SET role_id = orl.id
  FROM public.organization_roles orl
  WHERE uo.role_id IS NULL AND uo.role = 'write' AND orl.organization_id = uo.organization_id AND orl.name = 'Editor';

  UPDATE public.user_organizations uo
  SET role_id = orl.id
  FROM public.organization_roles orl
  WHERE uo.role_id IS NULL AND uo.role = 'read' AND orl.organization_id = uo.organization_id AND orl.name = 'Viewer';
END $$;
