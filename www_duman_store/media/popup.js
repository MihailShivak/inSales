document.addEventListener('DOMContentLoaded', function (){
  let popup = document.querySelector('#popup')
  if(!popup){
    let popupElem = document.createElement('div')
    let popupContentElem = document.createElement('div')
    popupElem.setAttribute('id', 'popup')
    popupContentElem.classList.add('popup-content')
    popupElem.appendChild(popupContentElem)
    document.body.appendChild(popupElem)
    popup = document.querySelector('#popup')
  }
  let popupContent = popup.querySelector('.popup-content')

  document.addEventListener('click', function(event){
    let elem = event.target
    let popupId = elem.getAttribute('data-popup')

    if(popupId){
      let template = document.querySelector(`template[data-id="${popupId}"]`)
      if(template){
          popupContent.appendChild(template.content.cloneNode(true))
          popup.classList.add('active')
      }
    } else if(elem.classList.contains('popup-close') || elem.getAttribute('id')=="popup"){
      popup.classList.remove('active')
      popupContent.replaceChildren();
    }
  })
})
;
