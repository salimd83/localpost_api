import VueRouter from "vue-router";
// import Vue from "vue";

import Login from "./components/Login";
import Messages from "./components/messages/Wall";

const routes = [
  { path: "/", name: 'home', component: Messages, meta: { requiresAuth: true } },
  { path: "/login", name: 'login', component: Login },
];

const router = new VueRouter({
  mode: "history",
  routes
});

// router.beforeResolve((to, from, next) => {
//   if (to.matched.some(record => record.meta.requiresAuth)) {
//     if (!localStorage.getItem('token')) {
//       next("/login")
//       return
//     }
//   }

//   next();
// });

export default router;
