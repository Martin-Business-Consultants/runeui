Rails.application.routes.draw do
  root "pages#show"
  patch "/", to: "pages#update"
  get "frame", to: "pages#frame"
  post "stream", to: "pages#stream"
  get "reactive", to: "pages#reactive"
  patch "reactive", to: "pages#reactive_update"
  get "reactive_server", to: "pages#reactive_server"
  patch "reactive_server", to: "pages#reactive_update"
  get "panel", to: "pages#panel"
  get "peek/:id", to: "pages#peek", as: :peek
  get "here", to: "pages#here"
  get "bridge", to: "pages#bridge"
end
