import { NextResponse } from 'next/server'

const DISPOSABLE_DOMAINS = new Set([
  'noproposal.com','mailinator.com','guerrillamail.com','tempmail.com','throwam.com',
  'sharklasers.com','guerrillamail.info','spam4.me','yopmail.com','trashmail.com',
  'dispostable.com','maildrop.cc','spamgourmet.com','spamgourmet.net','jetable.fr.nf',
  'dodgeit.com','spamfree24.org','mailnull.com','spamgourmet.org','spam.la',
  'trashmail.at','trashmail.io','trashmail.me','trashmail.net','wegwerfmail.de',
  'wegwerfmail.net','wegwerfmail.org','spamgourmet.com','mailexpire.com','throwam.com',
  'filzmail.com','fakeinbox.com','tempr.email','discard.email','spamex.com',
  'mailnesia.com','mailnull.com','spamgourmet.net','trashmail.org','getnada.com',
  'amilegit.com','anonbox.net','anonymbox.com','antichef.com','antichef.net',
  'antireg.ru','antispam.de','antispammail.de','armyspy.com','binkmail.com',
  'bobmail.info','chammy.info','chogmail.com','cool.fr.nf','courrieltemporaire.com',
  'cubiclink.com','dacoolest.com','dandikmail.com','dayrep.com','dcemail.com',
  'deadaddress.com','deadletter.ga','delikkt.de','despam.it','devnullmail.com',
  'discard.cf','discard.ga','discard.gq','discard.ml','discardmail.com',
  'discardmail.de','disposableaddress.com','disposableemailaddresses.com',
  'disposableinbox.com','dispose.it','divideandconquer.se','dm.w3internet.co.uk',
  'dodgeit.com','dodgemail.de','donemail.ru','dontreg.com','dontsendmespam.de',
  'drdrb.com','drdrb.net','dump-email.info','dumpandfuck.com','dumpmail.de',
  'dumpyemail.com','e4ward.com','email60.com','emailgo.de','emailias.com',
  'emaillime.com','emailmiser.com','emailsensei.com','emailtemporario.com.br',
  'emailtemporar.ro','emailthe.net','emailtmp.com','emailwarden.com','emailx.at.hm',
  'emailxfer.com','emz.net','enterto.com','ephemail.net','etranquil.com',
  'explodemail.com','express.net.ua','extremail.ru','eyepaste.com',
  'fakemailgenerator.com','fastacura.com','fastchevy.com','fastchrysler.com',
  'fastkawasaki.com','fastmazda.com','fastmitsubishi.com','fastnissan.com',
  'fastsubaru.com','fastsuzuki.com','fasttoyota.com','fastyamaha.com',
  'filzmail.com','fixmail.tk','fleckens.hu','frapmail.com','fudgerub.com',
  'fux0ringduh.com','get1mail.com','getairmail.com','getmails.eu','getonemail.com',
  'ghosttexter.de','girlsundertheinfluence.com','gishpuppy.com','glitch.sx',
  'gowikibooks.com','gowikicampus.com','gowikicars.com','gowikifilms.com',
  'gowikigames.com','gowikimusic.com','gowikinetwork.com','gowikitravel.com',
  'gowikitv.com','grandmasmail.com','great-host.in','greensloth.com','grr.la',
  'guerrillamail.biz','guerrillamail.de','guerrillamail.net','guerrillamail.org',
  'guerrillamailblock.com','gustr.com','harakirimail.com','hat-geld.de',
  'hatespam.org','herp.in','hidemail.de','hidzz.com','hmamail.com','hopemail.biz',
  'ieatspam.eu','ieatspam.info','ieh-mail.de','ignoremail.com','ihateyoualot.info',
  'iheartspam.org','imails.info','inboxclean.com','inboxclean.org','inoutmail.de',
  'inoutmail.eu','inoutmail.info','inoutmail.net','insorg.org','instant-mail.de',
  'ip6.li','irish2me.com','iwi.net','jetable.com','jetable.fr.nf','jetable.net',
  'jetable.org','jnxjn.com','jourrapide.com','jsrsolutions.com','kasmail.com',
  'kaspop.com','killmail.com','killmail.net','kir.ch.tc','klassmaster.com',
  'klassmaster.net','klassmaster.org','klzlk.com','koszmail.pl','kurzepost.de',
  'letthemeatspam.com','lhsdv.com','lifebyfood.com','link2mail.net','litedrop.com',
  'lol.ovpn.to','lolfreak.net','lookugly.com','lortemail.dk','lukecarriere.com',
  'lunchboxmail.com','mail-temporaire.fr','mail.by','mail1a.de','mailbidon.com',
  'mailbiz.biz','mailblocks.com','mailbucket.org','mailc.net','mailcat.biz',
  'mailchop.com','maildu.de','mailexpire.com','mailf5.com','mailfall.com',
  'mailfreeonline.com','mailguard.me','mailimate.com','mailinater.com',
  'mailismagic.com','mailme.ir','mailme.lv','mailme24.com','mailmetrash.com',
  'mailmoat.com','mailnew.com','mailnull.com','mailorg.org','mailpick.biz',
  'mailproxsy.com','mailquack.com','mailrobot.de','mailsac.com','mailscrap.com',
  'mailshell.com','mailshuttle.com','mailsiphon.com','mailslapping.com',
  'mailslite.com','mailsm.se','mailsnull.com','mailspam.info','mailspam.me',
  'mailspam.xyz','mailtemporaire.com','mailtemporaire.fr','mailtrash.net',
  'mailtv.net','mailtv.tv','mailzilla.com','mailzilla.org','makemetheking.com',
  'manybrain.com','mbx.cc','mega.zik.dj','meltmail.com','messagebeamer.de',
  'mierdamail.com','mintemail.com','mmmmail.com','moakt.com','moakt.cc',
  'moakt.ws','mohmal.com','moncourrier.fr.nf','monemail.fr.nf','monmail.fr.nf',
  'mosaicfx.com','mt2009.com','mt2014.com','myemailboxy.com','mymail-in.net',
  'mymailoasis.com','mypartyclip.de','myphantomemail.com','myspaceinc.com',
  'myspaceinc.net','myspaceinc.org','myspacepimps.net','mytrashmail.com',
  'nabuma.com','neomailbox.com','nervmich.net','nervtmich.net','netmails.com',
  'netmails.net','nevermail.de','nh3.ro','nicknassar.com','nobulk.com',
  'noclickemail.com','nogmailspam.info','nomail.pw','nomail.xl.cx','nomail2me.com',
  'nomorespamemails.com','nonspam.eu','nonspammer.de','noref.in','noreplybr.com',
  'nospam.ze.tc','nospam4.us','nospamfor.us','nospammail.net','nospamthanks.info',
  'notmailinator.com','nowmymail.com','ntlhelp.net','nullbox.info','nwldx.com',
  'o2business.co.uk','objectmail.com','obobbo.com','odnorazovoe.ru','oneoffemail.com',
  'onewaymail.com','online.ms','onqin.com','opayq.com','open-mail.net',
  'opentrash.com','ordinaryamerican.net','otherinbox.com','ourklips.com',
  'outlawspam.com','owlpic.com','pancakemail.com','pcusers.otherinbox.com',
  'pepbot.com','pimpedupmyspace.com','pipebomb.hu','plexolan.de','poczta.onet.pl',
  'politikerclub.de','poofy.org','pookmail.com','privacy.net','privatdemail.net',
  'proxymail.eu','prtnx.com','prtz.eu','pubmail.io','punkass.com',
  'putthisinyourspamdatabase.com','putthisinyourspamdatabase.net','qq.com',
  'quickinbox.com','quickmail.nl','rcpt.at','recode.me','recursor.net',
  'recyclemail.dk','regbypass.com','regbypass.comsafe-mail.net','rklips.com',
  'rmqkr.net','royal.net','rppkn.com','rtrtr.com','s0ny.net','safe-mail.net',
  'safersignup.de','safetymail.info','safetypost.de','sandelf.de','saynotospams.com',
  'schafmail.de','schrott-email.de','secrete-mail.com','secure-mail.biz',
  'selfdestructingmail.com','sendspamhere.com','senseless-entertainment.com',
  'seven-neuro.com','shieldedmail.com','shiftmail.com','shitmail.me',
  'shitmail.org','shitware.nl','shmeriously.com','shotmail.ru','showslow.de',
  'sinamail.com','sinnlos-mail.de','siteposter.net','slaskpost.se','smellfear.com',
  'smmwrks.com','snakemail.com','sneakemail.com','sneakmail.de','snkmail.com',
  'sofimail.com','sofort-mail.de','sogetthis.com','soisz.com','solar-impact.pro',
  'soodomail.com','soodonims.com','spam.la','spam.org.es','spam.su','spam4.me',
  'spamavert.com','spambox.info','spambox.irishspringrealty.com','spambox.us',
  'spamcannon.com','spamcannon.net','spamcero.com','spamcon.org','spamcorptastic.com',
  'spamcowboy.com','spamcowboy.net','spamcowboy.org','spamday.com','spamdecoy.net',
  'spamex.com','spamfree.eu','spamfree24.de','spamfree24.eu','spamfree24.info',
  'spamfree24.net','spamgoes.in','spamgourmet.com','spamgourmet.net','spamgourmet.org',
  'spamherelots.com','spamherenow.com','spamhole.com','spamify.com','spaminator.de',
  'spamkill.info','spaml.de','spamlot.net','spammm.com','spammotel.com',
  'spammy.host','spamnot.com','spamoff.de','spamsalad.in','spamsimple.com',
  'spamthis.co.uk','spamthisplease.com','spamtrail.com','spamtroll.net',
  'speed.1s.fr','spikio.com','spoofmail.de','squizzy.de','squizzy.eu',
  'squizzy.net','stinkefinger.net','streetwisemail.com','stuffmail.de',
  'super-auswahl.de','supergreatmail.com','supermailer.jp','superrito.com',
  'superstachel.de','suremail.info','svk.jp','sweetxxx.de','tafmail.com',
  'teewars.org','teleworm.com','teleworm.us','tempalias.com','tempe-mail.com',
  'tempemail.biz','tempemail.com','tempemail.net','tempinbox.co.uk','tempinbox.com',
  'tempmail.eu','tempmail.it','tempmail.us','tempmaildemo.com','tempmailer.com',
  'tempomail.fr','temporaryemail.net','temporaryemail.us','temporaryforwarding.com',
  'temporaryinbox.com','temporarymailaddress.com','tempthe.net','thanksnospam.com',
  'thanksnospam.net','thc.st','thelimestones.com','thisisnotmyrealemail.com',
  'throam.com','throwam.com','throwaway.email','throwam.com','tradermail.info',
  'trash-mail.at','trash-mail.cf','trash-mail.ga','trash-mail.gq','trash-mail.io',
  'trash-mail.ml','trash-mail.tk','trash2009.com','trash2010.com','trash2011.com',
  'trashdevil.com','trashdevil.de','trashemail.de','trashmail.at','trashmail.com',
  'trashmail.io','trashmail.me','trashmail.net','trashmail.org','trashmailer.com',
  'trashme.xyz','trashspam.com','trillianpro.com','trmailbox.com','trmailbox.net',
  'tryalert.com','turual.com','twinmail.de','tyldd.com','uggsrock.com',
  'umail.net','uroid.com','us.af','uzxia.cc','venompen.com','veryrealemail.com',
  'viditag.com','viewcastmedia.com','viewcastmedia.net','viewcastmedia.org',
  'vinernet.com','vipmail.pw','vomoto.com','vorsicht-mailclubs.de','w3internet.co.uk',
  'w9f.de','was-nicht-ist.de','webemail.me','weg-werf-email.de','wegwerf-email.de',
  'wegwerf-emails.de','wegwerfadresse.de','wegwerfmail.de','wegwerfmail.net',
  'wegwerfmail.org','wetrainbayarea.com','wetrainbayarea.org','wh4f.org',
  'whatiaas.com','whatpaas.com','whatsaas.com','whopy.com','wilemail.com',
  'willhackforfood.biz','willselfdestruct.com','wmail.cf','writeme.us',
  'wronghead.com','wuzupmail.net','www.e4ward.com','wwwnew.eu','x.ip6.li',
  'xagloo.co','xagloo.com','xemaps.com','xents.com','xmaily.com','xoxy.net',
  'xwpet.com','yapped.net','yeah.net','yep.it','yopmail.com','yopmail.fr',
  'yourdomain.com','ypmail.webarnak.fr.eu.org','yuurok.com','z1p.biz',
  'za.com','zehnminuten.de','zehnminutenmail.de','zippymail.info','zoaxe.com',
  'zoemail.net','zoemail.org','zomg.info','zxcv.com','zxcvbnm.com','zzz.com',
  'inbox.lv',
])

export async function POST(req) {
  try {
    const { token, email } = await req.json()

    if (email) {
      const domain = email.split('@')[1]?.toLowerCase().trim()
      if (domain && DISPOSABLE_DOMAINS.has(domain)) {
        return NextResponse.json(
          { ok: false, error: 'Please use a permanent email address to sign up.' },
          { status: 400 }
        )
      }
    }

    if (!token) {
      return NextResponse.json(
        { ok: false, error: 'Security check required. Please complete the CAPTCHA.' },
        { status: 400 }
      )
    }

    const secret = process.env.TURNSTILE_SECRET_KEY
    if (!secret) {
      // If key not configured yet, allow through (avoids breaking signup during env setup)
      console.warn('[Turnstile] TURNSTILE_SECRET_KEY not set — skipping verification')
      return NextResponse.json({ ok: true })
    }

    const formData = new FormData()
    formData.append('secret', secret)
    formData.append('response', token)

    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: formData,
    })
    const data = await res.json()

    if (!data.success) {
      return NextResponse.json(
        { ok: false, error: 'Security check failed. Please try again.' },
        { status: 400 }
      )
    }

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json(
      { ok: false, error: 'Verification error. Please try again.' },
      { status: 500 }
    )
  }
}
