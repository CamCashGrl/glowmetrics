'use client'

export default function PromoButtons({ styles }) {
  const trackClick = (label) => {
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', 'link_click', {
        event_category: 'bongacams_promotion',
        event_label: label,
        page_title: document.title,
      })
    }
  }

  return (
    <div style={styles.promoButtons}>
      <a
        href="https://bongamodels.com?fuid=DaphneDawson&utm_source=camcashgrl&utm_medium=blog&utm_campaign=bongacams_signup"
        target="_blank"
        rel="noopener noreferrer"
        style={{...styles.promoBtn, ...styles.promoBtnModel}}
        onClick={() => trackClick('interested_in_being_model')}
      >
        Interested in being a model?
      </a>
      <a
        href="https://bongacams.com?fuid=166966512&utm_source=camcashgrl&utm_medium=blog&utm_campaign=bongacams_viewer"
        target="_blank"
        rel="noopener noreferrer"
        style={{...styles.promoBtn, ...styles.promoBtnCam}}
        onClick={() => trackClick('looking_for_hot_cam_show')}
      >
        Looking for a hot cam show?
      </a>
    </div>
  )
}
