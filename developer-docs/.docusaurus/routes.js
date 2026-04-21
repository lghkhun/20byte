import React from 'react';
import ComponentCreator from '@docusaurus/ComponentCreator';

export default [
  {
    path: '/',
    component: ComponentCreator('/', '88d'),
    routes: [
      {
        path: '/',
        component: ComponentCreator('/', 'daf'),
        routes: [
          {
            path: '/',
            component: ComponentCreator('/', 'b7e'),
            routes: [
              {
                path: '/authentication',
                component: ComponentCreator('/authentication', 'ecb'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/endpoints/endpoints-device',
                component: ComponentCreator('/endpoints/endpoints-device', '5da'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/endpoints/endpoints-groups',
                component: ComponentCreator('/endpoints/endpoints-groups', '1a9'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/endpoints/endpoints-messages',
                component: ComponentCreator('/endpoints/endpoints-messages', '4c2'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/endpoints/endpoints-schedules',
                component: ComponentCreator('/endpoints/endpoints-schedules', 'b28'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/endpoints/endpoints-webhook',
                component: ComponentCreator('/endpoints/endpoints-webhook', 'a94'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/error-codes',
                component: ComponentCreator('/error-codes', 'a24'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/migration-woowa',
                component: ComponentCreator('/migration-woowa', '241'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/payloads',
                component: ComponentCreator('/payloads', '972'),
                exact: true,
                sidebar: "apiSidebar"
              },
              {
                path: '/',
                component: ComponentCreator('/', '337'),
                exact: true,
                sidebar: "apiSidebar"
              }
            ]
          }
        ]
      }
    ]
  },
  {
    path: '*',
    component: ComponentCreator('*'),
  },
];
