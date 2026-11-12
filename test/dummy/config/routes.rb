Rails.application.routes.draw do
  root "pages#show"
  patch "/", to: "pages#update"
  get "frame", to: "pages#frame"
  post "stream", to: "pages#stream"
end
